import type { Graph, GraphNode } from "../services/indoorNavigation";

// Draft walking centre lines traced from the supplied floor plan, not a navmesh.
// Its 1 m scale bar spans ~86 px. GLB bounds (14.886 x 10.846 m) were inspected
// for room arrangement; the GLB and plan are NOT automatically registered.
// Distances remain estimates until a physical walk verifies scale and clearance.
export const HOME_SCALE = 86;
export const HOME_START_PIXEL = { x: 325, y: 233 };
const node = (id: string, label: string, x: number, y: number): GraphNode => ({
    id, label, x: (x - HOME_START_PIXEL.x) / HOME_SCALE,
    y: (y - HOME_START_PIXEL.y) / HOME_SCALE,
});

export const homeGraph: Graph = {
    nodes: [
        node("start", "Red X · Bedroom 1 desk", 325, 233),
        node("desk-clear", "Clear the desk", 195, 280),
        node("bed-side", "Left side of the bed", 180, 330),
        node("bed-foot", "Past the foot of the bed", 180, 545),
        node("bedroom-exit-approach", "Bedroom 1 exit approach", 355, 548),
        node("bedroom-exit", "Bedroom 1 doorway", 443, 548),
        node("living-west", "Living room west side", 510, 548),
        node("living", "Living room", 620, 560),
        node("hub", "Living room junction", 580, 680),
        node("bedroom2-approach", "Bedroom 2 approach", 515, 735),
        node("bedroom2-door", "Bedroom 2 doorway", 487, 788),
        node("bedroom2", "Bedroom 2", 386, 806),
        node("east-hub", "Office / east passage junction", 826, 705),
        node("office-approach", "Office approach", 832, 738),
        node("office-door", "Office doorway", 832, 780),
        node("office", "Office", 736, 858),
        node("passage", "Other 2 · passage", 945, 703),
        node("right-door", "Right-hand room doorway", 1028, 703),
        node("right-room", "Other 1 · right-hand room", 1160, 777),
        node("closet-approach", "Closet approach", 1140, 905),
        node("closet-door", "Closet doorway", 1138, 963),
        node("closet", "Closet", 1140, 1033),
    ],
    edges: [
        ["start", "desk-clear"], ["desk-clear", "bed-side"], ["bed-side", "bed-foot"],
        ["bed-foot", "bedroom-exit-approach"], ["bedroom-exit-approach", "bedroom-exit"],
        ["bedroom-exit", "living-west"], ["living-west", "living"], ["living-west", "hub"],
        ["living", "hub"], ["hub", "bedroom2-approach"], ["bedroom2-approach", "bedroom2-door"],
        ["bedroom2-door", "bedroom2"], ["hub", "east-hub"],
        ["east-hub", "office-approach"], ["office-approach", "office-door"],
        ["office-door", "office"], ["east-hub", "passage"], ["passage", "right-door"],
        ["right-door", "right-room"], ["right-room", "closet-approach"],
        ["closet-approach", "closet-door"], ["closet-door", "closet"],
    ],
};

export const homeDestinations = ["living", "bedroom2", "office", "passage", "right-room", "closet"]
    .map(id => homeGraph.nodes.find(n => n.id === id)!);

// Simplified room outlines in source-plan pixels for a small offline preview.
export const homeRooms = [
    { name: "Bedroom 1", x: 95, y: 166, width: 342, height: 420 },
    { name: "Living room", x: 443, y: 295, width: 395, height: 448 },
    { name: "Bedroom 2", x: 113, y: 750, width: 294, height: 325 },
    { name: "Office", x: 565, y: 819, width: 316, height: 259 },
    { name: "Passage", x: 840, y: 655, width: 186, height: 99 },
    { name: "Other 1", x: 1095, y: 655, width: 294, height: 300 },
    { name: "Closet", x: 1095, y: 957, width: 102, height: 120 },
];
