"""303 survey templates. Independent floor frames; never interpolate across floors."""
import hashlib
import heapq
import json
import math
from pathlib import Path
from fastapi import HTTPException

DATA = json.loads((Path(__file__).parents[1] / "data/wayfinding/building_303.json").read_text())
NODES = {n["code"]: n for n in DATA["nodes"]}
TARGETS = {d["code"]: d for d in DATA["destinations"]}
STARTS = {n["code"]: n for n in DATA["nodes"] if n["type"] in {"entrance", "stairs", "elevator"}}


def template(start: str, destination: str, accessible: bool, include_gaps: bool):
    if start not in STARTS or destination not in TARGETS:
        raise HTTPException(404, "Unknown Building 303 start or destination")
    edges = list(DATA["edges"])
    if include_gaps:
        edges += [dict(e, type="survey_gap", accessible=True) for e in DATA["pending_connections"]]
    adjacency = {key: [] for key in NODES}
    for e in edges:
        if accessible and not e.get("accessible"):
            continue
        a, b = NODES[e["from"]], NODES[e["to"]]
        weight = e.get("distance_m", math.hypot(a["x"]-b["x"], a["z"]-b["z"]))
        adjacency[a["code"]].append((b["code"], weight, e))
        adjacency[b["code"]].append((a["code"], weight, e))
    queue, costs, previous = [(0, start)], {start: 0}, {}
    end = None
    while queue:
        cost, code = heapq.heappop(queue)
        if cost != costs[code]:
            continue
        if code in TARGETS[destination]["doors"]:
            end = code
            break
        for other, weight, edge in adjacency[code]:
            if cost+weight < costs.get(other, math.inf):
                costs[other] = cost+weight
                previous[other] = (code, edge)
                heapq.heappush(queue, (cost+weight, other))
    if end is None:
        raise HTTPException(422, "No connected route. Editors may include survey gaps, but must walk and verify them before publishing.")
    path, connections = [end], []
    while path[0] != start:
        before, edge = previous[path[0]]
        path.insert(0, before)
        connections.insert(0, edge)
    groups = [[path[0]]]
    transitions = []
    for i, code in enumerate(path[1:]):
        if NODES[code]["floor"] != NODES[groups[-1][-1]]["floor"]:
            transitions.append(connections[i]["type"])
            groups.append([])
        groups[-1].append(code)
    legs = []
    for i, group in enumerate(groups):
        first = NODES[group[0]]
        # Positive local Y points from the start towards the next surveyed node.
        second = NODES[group[1]] if len(group)>1 else first
        dx, dz = second["x"]-first["x"], second["z"]-first["z"]
        length = math.hypot(dx, dz)
        fx, fz = (dx/length, dz/length) if length else (0, 1)
        points = []
        for code in group:
            n = NODES[code]
            x, z = n["x"]-first["x"], n["z"]-first["z"]
            points.append(dict(id=code, label=n["name"], x=round(fz*x-fx*z, 4), y=round(fx*x+fz*z, 4)))
        legs.append(dict(floor=first["floor"], start_label=first["name"],
                         heading_label=second["name"] if length else "choose and record a fixed reference direction",
                         transition=transitions[i] if i<len(transitions) else None,
                         points=points))
    identity = dict(start=start, destination=destination, accessible=accessible, include_gaps=include_gaps)
    key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()[:24]
    return dict(key=key, building="303", **identity, legs=legs,
                survey_gaps=[e["reason"] for e in connections if e["type"]=="survey_gap"])
