"""Inspect a Polycam GLB and create a lightweight top-down density projection.

This tool deliberately uses only the Python standard library so contributors can
inspect source scans without adding geometry packages to the backend runtime.
It does not attempt to infer a navigation graph automatically.

Example:
    python backend/scripts/inspect_wayfinding_glb.py scan.glb --output scan.png
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import zlib
from pathlib import Path


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
GLB_MAGIC = 0x46546C67


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("File is too small to be a GLB")

    magic, version, declared_length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC or version != 2:
        raise ValueError("Expected a binary glTF 2.0 file")
    if declared_length != len(data):
        raise ValueError(
            f"GLB declares {declared_length} bytes but contains {len(data)} bytes"
        )

    document = None
    binary = None
    offset = 12
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == JSON_CHUNK:
            document = json.loads(chunk.rstrip(b" \t\r\n\x00"))
        elif chunk_type == BIN_CHUNK:
            binary = chunk

    if document is None or binary is None:
        raise ValueError("GLB must contain JSON and BIN chunks")
    return document, binary


def identity_matrix() -> tuple[float, ...]:
    return (
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    )


def multiply(left: tuple[float, ...], right: tuple[float, ...]) -> tuple[float, ...]:
    result = [0.0] * 16
    for column in range(4):
        for row in range(4):
            result[column * 4 + row] = sum(
                left[index * 4 + row] * right[column * 4 + index]
                for index in range(4)
            )
    return tuple(result)


def node_matrix(node: dict) -> tuple[float, ...]:
    if "matrix" in node:
        return tuple(float(value) for value in node["matrix"])

    tx, ty, tz = node.get("translation", [0.0, 0.0, 0.0])
    qx, qy, qz, qw = node.get("rotation", [0.0, 0.0, 0.0, 1.0])
    sx, sy, sz = node.get("scale", [1.0, 1.0, 1.0])

    xx, yy, zz = qx * qx, qy * qy, qz * qz
    xy, xz, yz = qx * qy, qx * qz, qy * qz
    wx, wy, wz = qw * qx, qw * qy, qw * qz
    return (
        (1 - 2 * (yy + zz)) * sx,
        (2 * (xy + wz)) * sx,
        (2 * (xz - wy)) * sx,
        0.0,
        (2 * (xy - wz)) * sy,
        (1 - 2 * (xx + zz)) * sy,
        (2 * (yz + wx)) * sy,
        0.0,
        (2 * (xz + wy)) * sz,
        (2 * (yz - wx)) * sz,
        (1 - 2 * (xx + yy)) * sz,
        0.0,
        tx,
        ty,
        tz,
        1.0,
    )


def transform_point(matrix: tuple[float, ...], point: tuple[float, float, float]):
    x, y, z = point
    return (
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    )


def read_positions(document: dict, binary: bytes, accessor_index: int):
    accessor = document["accessors"][accessor_index]
    if accessor.get("componentType") != 5126 or accessor.get("type") != "VEC3":
        raise ValueError("POSITION accessor must contain float VEC3 data")
    if "sparse" in accessor:
        raise ValueError("Sparse POSITION accessors are not supported")

    view = document["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", 12)
    count = accessor["count"]
    for index in range(count):
        yield struct.unpack_from("<fff", binary, start + index * stride)


def collect_world_positions(document: dict, binary: bytes):
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    scene_index = document.get("scene", 0)
    roots = document.get("scenes", [{}])[scene_index].get("nodes", [])

    positions: list[tuple[float, float, float]] = []

    def visit(node_index: int, parent_matrix: tuple[float, ...]):
        node = nodes[node_index]
        world_matrix = multiply(parent_matrix, node_matrix(node))
        if "mesh" in node:
            mesh = meshes[node["mesh"]]
            for primitive in mesh.get("primitives", []):
                accessor_index = primitive.get("attributes", {}).get("POSITION")
                if accessor_index is None:
                    continue
                positions.extend(
                    transform_point(world_matrix, point)
                    for point in read_positions(document, binary, accessor_index)
                )
        for child_index in node.get("children", []):
            visit(child_index, world_matrix)

    for root_index in roots:
        visit(root_index, identity_matrix())
    return positions


def bounds(points: list[tuple[float, float, float]]):
    minimum = [math.inf, math.inf, math.inf]
    maximum = [-math.inf, -math.inf, -math.inf]
    for point in points:
        for axis in range(3):
            minimum[axis] = min(minimum[axis], point[axis])
            maximum[axis] = max(maximum[axis], point[axis])
    return minimum, maximum


def filter_height_band(
    points: list[tuple[float, float, float]],
    up_axis: int,
    minimum_height: float | None,
    maximum_height: float | None,
):
    if minimum_height is None and maximum_height is None:
        return points
    return [
        point
        for point in points
        if (minimum_height is None or point[up_axis] >= minimum_height)
        and (maximum_height is None or point[up_axis] <= maximum_height)
    ]


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, width: int, height: int, pixels: bytearray):
    scanlines = bytearray()
    row_size = width * 3
    for row in range(height):
        scanlines.append(0)
        start = row * row_size
        scanlines.extend(pixels[start : start + row_size])
    payload = bytearray(b"\x89PNG\r\n\x1a\n")
    payload.extend(png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)))
    payload.extend(png_chunk(b"IDAT", zlib.compress(bytes(scanlines), level=9)))
    payload.extend(png_chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def render_top_down(
    points: list[tuple[float, float, float]],
    output: Path,
    up_axis: int,
    max_dimension: int,
    world_bounds: tuple[list[float], list[float]] | None = None,
):
    minimum, maximum = world_bounds or bounds(points)
    plane_axes = [axis for axis in range(3) if axis != up_axis]
    first, second = plane_axes
    first_span = maximum[first] - minimum[first]
    second_span = maximum[second] - minimum[second]
    if not first_span or not second_span:
        raise ValueError("Projection has a zero-width axis")

    margin = 24
    usable = max_dimension - margin * 2
    if first_span >= second_span:
        width = max_dimension
        height = max(320, round(usable * second_span / first_span) + margin * 2)
    else:
        height = max_dimension
        width = max(320, round(usable * first_span / second_span) + margin * 2)

    density = [0] * (width * height)
    for point in points:
        x = margin + round((point[first] - minimum[first]) / first_span * (width - 2 * margin - 1))
        y = margin + round((maximum[second] - point[second]) / second_span * (height - 2 * margin - 1))
        density[y * width + x] += 1

    nonzero = sorted(value for value in density if value)
    reference = nonzero[max(0, round(len(nonzero) * 0.98) - 1)] if nonzero else 1
    scale = math.log1p(max(reference, 1))
    pixels = bytearray([255] * (width * height * 3))
    for index, value in enumerate(density):
        if not value:
            continue
        strength = min(1.0, math.log1p(value) / scale)
        colour = (
            round(190 - 170 * strength),
            round(215 - 165 * strength),
            round(235 - 145 * strength),
        )
        pixel_index = index * 3
        pixels[pixel_index : pixel_index + 3] = bytes(colour)

    write_png(output, width, height, pixels)
    return width, height


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb", type=Path)
    parser.add_argument("--output", type=Path, help="Optional top-down PNG output")
    parser.add_argument("--max-dimension", type=int, default=1600)
    parser.add_argument(
        "--height-min",
        type=float,
        help="Optional minimum world-space height in metres for the projection",
    )
    parser.add_argument(
        "--height-max",
        type=float,
        help="Optional maximum world-space height in metres for the projection",
    )
    args = parser.parse_args()

    document, binary = read_glb(args.glb)
    points = collect_world_positions(document, binary)
    if not points:
        raise ValueError("No mesh positions found")

    minimum, maximum = bounds(points)
    spans = [maximum[index] - minimum[index] for index in range(3)]
    up_axis = min(range(3), key=spans.__getitem__)
    projection_points = filter_height_band(
        points,
        up_axis,
        args.height_min,
        args.height_max,
    )
    if not projection_points:
        raise ValueError("No mesh positions fall inside the requested height band")
    axis_names = ["X", "Y", "Z"]
    summary = {
        "file": str(args.glb.resolve()),
        "file_size_bytes": args.glb.stat().st_size,
        "mesh_count": len(document.get("meshes", [])),
        "vertex_count": len(points),
        "bounds_min_m": dict(zip(axis_names, (round(value, 4) for value in minimum))),
        "bounds_max_m": dict(zip(axis_names, (round(value, 4) for value in maximum))),
        "span_m": dict(zip(axis_names, (round(value, 4) for value in spans))),
        "inferred_up_axis": axis_names[up_axis],
        "projection_vertex_count": len(projection_points),
    }
    if args.height_min is not None or args.height_max is not None:
        summary["height_band_m"] = {
            "minimum": args.height_min,
            "maximum": args.height_max,
        }
    if args.output:
        width, height = render_top_down(
            projection_points,
            args.output,
            up_axis,
            max(320, args.max_dimension),
            (minimum, maximum),
        )
        summary["projection"] = {
            "file": str(args.output.resolve()),
            "width_px": width,
            "height_px": height,
            "plane_axes": [axis_names[index] for index in range(3) if index != up_axis],
        }

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
