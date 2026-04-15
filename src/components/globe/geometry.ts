import * as THREE from "three";
import { GLOBE_RADIUS } from "./constants";

/* ── Coordinate conversion ─────────────────────────────────── */

/** Convert geodetic lat/lng to a 3-D point on the sphere of radius r. */
export function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ── Point distribution ────────────────────────────────────── */

/** Fibonacci sphere — near-uniform point distribution on a sphere. */
export function fibSphere(n: number) {
  const pts: { x: number; y: number; z: number; lat: number; lng: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y  = 1 - (i / (n - 1)) * 2;
    const r  = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x  = Math.cos(th) * r;
    const z  = Math.sin(th) * r;
    pts.push({
      x: x * GLOBE_RADIUS,
      y: y * GLOBE_RADIUS,
      z: z * GLOBE_RADIUS,
      lat: Math.asin(y) * (180 / Math.PI),
      lng: Math.atan2(z, x) * (180 / Math.PI),
    });
  }
  return pts;
}

/* ── Arc geometry ──────────────────────────────────────────── */

/** Quadratic Bézier arc between two points on the globe surface. */
export function arcGeom(a: THREE.Vector3, b: THREE.Vector3, lift: number) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.normalize().multiplyScalar(GLOBE_RADIUS + lift);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
}

/* ── Region outline ────────────────────────────────────────── */

/** Build a closed polyline that traces a lat/lng bounding box on the globe surface. */
export function bboxToGlobeOutline(
  bbox: [number, number, number, number],
  r: number,
  segments = 24,
): THREE.Vector3[] {
  const [west, south, east, north] = bbox;
  const pts: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++)
    pts.push(latLngToVec3(south, west + ((east - west) * i) / segments, r));
  for (let i = 1; i <= segments; i++)
    pts.push(latLngToVec3(south + ((north - south) * i) / segments, east, r));
  for (let i = 1; i <= segments; i++)
    pts.push(latLngToVec3(north, east - ((east - west) * i) / segments, r));
  for (let i = 1; i <= segments; i++)
    pts.push(latLngToVec3(north - ((north - south) * i) / segments, west, r));

  pts.push(pts[0].clone()); // close
  return pts;
}

/* ── FlyTo quaternion ──────────────────────────────────────── */

/**
 * Return the globe quaternion that brings the given lat/lng directly
 * in front of the camera (onto the +Z axis), with a slight aesthetic tilt.
 */
export function computeTargetQuat(lat: number, lng: number): THREE.Quaternion {
  const p      = latLngToVec3(lat, lng, 1).normalize();
  const facing = new THREE.Vector3(0, 0, 1);
  const base   = new THREE.Quaternion().setFromUnitVectors(p, facing);
  const tilt   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.18);
  return tilt.multiply(base);
}
