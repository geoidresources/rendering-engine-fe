import * as THREE from "three";

export const GLOBE_RADIUS      = 1.0;
export const DOT_COUNT         = 28000;
export const OCEAN_SAMPLE_RATE = 0.06;
export const MESH_NODE_COUNT   = 50;
export const MESH_EDGE_THRESHOLD = 0.75;
export const ARC_COUNT         = 8;
export const ROTATION_SPEED    = 0.0006;
export const STAR_COUNT        = 1500;

export const COL = {
  land:     [1.0,  0.65, 0.2 ] as const,   // amber/orange
  landDim:  [0.6,  0.4,  0.12] as const,   // dimmer amber
  ocean:    [0.15, 0.2,  0.35] as const,   // deep blue-grey
  arc:      new THREE.Color(0.25, 0.55, 0.9),  // cyan-blue
  mesh:     new THREE.Color(0.3,  0.4,  0.55), // grey-blue
  meshNode: new THREE.Color(0.5,  0.6,  0.7 ),
  glow:     new THREE.Color(0.08, 0.18, 0.4 ), // deep blue
  marker:   new THREE.Color(1.0,  0.55, 0.1 ), // orange
  ring:     new THREE.Color(1.0,  0.6,  0.15),
} as const;
