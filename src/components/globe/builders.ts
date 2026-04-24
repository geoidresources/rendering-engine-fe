/**
 * builders.ts
 * -----------
 * Factory functions that construct Three.js objects and add them to the
 * provided group / scene.  Each function is pure in the sense that it only
 * reads its arguments and mutates the passed-in Three.js container — no
 * module-level state.
 */
import * as THREE from "three";
import {
  COL,
  GLOBE_RADIUS,
  DOT_COUNT,
  OCEAN_SAMPLE_RATE,
  MESH_NODE_COUNT,
  MESH_EDGE_THRESHOLD,
  ARC_COUNT,
  STAR_COUNT,
} from "./constants";
import { fibSphere, arcGeom, bboxToGlobeOutline, latLngToVec3 } from "./geometry";
import { isLand } from "./landmap";
import type { SiteLocationProp } from "./types";

/* ── Dot globe (land + ocean dots) ───────────────────────────── */

export interface DotGlobeResult {
  landVecs: THREE.Vector3[];
}

export function buildDotGlobe(
  globe: THREE.Group,
  landImg: ImageData | null,
): DotGlobeResult {
  const pts      = fibSphere(DOT_COUNT);
  const pos: number[]   = [];
  const sizes: number[] = [];
  const alphas: number[]= [];
  const colors: number[]= [];
  const landVecs: THREE.Vector3[] = [];

  for (const p of pts) {
    const onLand = landImg ? isLand(landImg, p.lat, p.lng) : Math.random() > 0.5;
    if (onLand) {
      pos.push(p.x, p.y, p.z);
      const bright = 0.3 + Math.random() * 0.35;
      sizes.push(0.7 + Math.random() * 0.3);
      alphas.push(bright);
      const t = Math.random();
      colors.push(
        COL.land[0] * (0.5 + bright * 0.5) + COL.landDim[0] * (1 - bright) * t * 0.3,
        COL.land[1] * (0.5 + bright * 0.5) + COL.landDim[1] * (1 - bright) * t * 0.3,
        COL.land[2] * (0.5 + bright * 0.5) + COL.landDim[2] * (1 - bright) * t * 0.3,
      );
      landVecs.push(new THREE.Vector3(p.x, p.y, p.z));
    } else if (Math.random() < OCEAN_SAMPLE_RATE) {
      pos.push(p.x, p.y, p.z);
      sizes.push(0.2 + Math.random() * 0.15);
      alphas.push(0.02 + Math.random() * 0.03);
      colors.push(COL.ocean[0], COL.ocean[1], COL.ocean[2]);
    }
  }

  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos,    3));
  dotGeo.setAttribute("size",     new THREE.Float32BufferAttribute(sizes,  1));
  dotGeo.setAttribute("alpha",    new THREE.Float32BufferAttribute(alphas, 1));
  dotGeo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));

  const dotMat = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      attribute vec3 color;
      varying float vA;
      varying vec3 vC;
      uniform float uPR;
      void main(){
        vA=alpha; vC=color;
        vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_PointSize=size*uPR*(8.0/ -mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying float vA;
      varying vec3 vC;
      void main(){
        float d=length(gl_PointCoord-.5);
        if(d>.5) discard;
        float a=smoothstep(.5,.0,d)*vA;
        gl_FragColor=vec4(vC,a);
      }`,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });
  globe.add(new THREE.Points(dotGeo, dotMat));

  return { landVecs };
}

/* ── Outer constellation mesh ─────────────────────────────────── */

export function buildConstellationMesh(globe: THREE.Group) {
  const meshR    = GLOBE_RADIUS * 1.18;
  const meshNodes: THREE.Vector3[] = [];
  const meshPosArr: number[] = [];

  for (let i = 0; i < MESH_NODE_COUNT; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const v  = new THREE.Vector3(
      meshR * Math.sin(ph) * Math.cos(th),
      meshR * Math.cos(ph),
      meshR * Math.sin(ph) * Math.sin(th),
    );
    meshNodes.push(v);
    meshPosArr.push(v.x, v.y, v.z);
  }

  // Node points
  const mnGeo = new THREE.BufferGeometry();
  mnGeo.setAttribute("position", new THREE.Float32BufferAttribute(meshPosArr, 3));
  globe.add(
    new THREE.Points(
      mnGeo,
      new THREE.PointsMaterial({
        color:       COL.meshNode,
        size:        0.018,
        transparent: true,
        opacity:     0.55,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
      }),
    ),
  );

  // Edges
  const edgePos: number[] = [];
  for (let i = 0; i < meshNodes.length; i++) {
    for (let j = i + 1; j < meshNodes.length; j++) {
      if (meshNodes[i].distanceTo(meshNodes[j]) < MESH_EDGE_THRESHOLD) {
        edgePos.push(
          meshNodes[i].x, meshNodes[i].y, meshNodes[i].z,
          meshNodes[j].x, meshNodes[j].y, meshNodes[j].z,
        );
      }
    }
  }
  if (edgePos.length) {
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePos, 3));
    globe.add(
      new THREE.LineSegments(
        eGeo,
        new THREE.LineBasicMaterial({
          color:       COL.mesh,
          transparent: true,
          opacity:     0.12,
          blending:    THREE.AdditiveBlending,
          depthWrite:  false,
        }),
      ),
    );
  }
}

/* ── Connection arcs ──────────────────────────────────────────── */

export function buildArcs(globe: THREE.Group, landVecs: THREE.Vector3[]) {
  if (landVecs.length <= 20) return;
  const arcMat = new THREE.LineBasicMaterial({
    color:       COL.arc,
    transparent: true,
    opacity:     0.12,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
  });
  for (let i = 0; i < ARC_COUNT; i++) {
    const a   = Math.floor(Math.random() * landVecs.length);
    let b     = Math.floor(Math.random() * landVecs.length);
    let tries = 0;
    while (landVecs[a].distanceTo(landVecs[b]) < 0.8 && tries++ < 30) {
      b = Math.floor(Math.random() * landVecs.length);
    }
    globe.add(
      new THREE.Line(
        arcGeom(landVecs[a], landVecs[b], 0.15 + Math.random() * 0.25),
        arcMat.clone(),
      ),
    );
  }
}

/* ── Atmosphere glow ──────────────────────────────────────────── */

export function buildAtmosphere(globe: THREE.Group) {
  const glowGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.45, 64, 64);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: COL.glow } },
    vertexShader: `
      varying float vI;
      void main(){
        vec3 vN=normalize(normalMatrix*normal);
        float rim=1.0-abs(dot(vN,vec3(0,0,1)));
        vI=pow(rim,8.0)*step(0.82,rim);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader: `
      uniform vec3 uCol;
      varying float vI;
      void main(){ gl_FragColor=vec4(uCol,vI*.1); }`,
    transparent: true,
    depthWrite:  false,
    side:        THREE.BackSide,
    blending:    THREE.AdditiveBlending,
  });
  globe.add(new THREE.Mesh(glowGeo, glowMat));
}

/* ── Site markers + bbox region highlights ───────────────────── */

export function buildSiteMarkers(
  globe: THREE.Group,
  sites: SiteLocationProp[],
): THREE.Mesh[] {
  const pulseRings: THREE.Mesh[] = [];

  for (const site of sites) {
    const mPos = latLngToVec3(site.lat, site.lng, GLOBE_RADIUS * 1.005);

    // Core glowing dot
    globe.add(
      Object.assign(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.014, 12, 12),
          new THREE.MeshBasicMaterial({ color: COL.marker }),
        ),
        { position: mPos } as unknown as Partial<THREE.Mesh>,
      ),
    );

    // Pulse rings (3 at different phases)
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.018, 0.024, 48),
        new THREE.MeshBasicMaterial({
          color:       COL.ring,
          transparent: true,
          opacity:     0.5,
          side:        THREE.DoubleSide,
          blending:    THREE.AdditiveBlending,
          depthWrite:  false,
        }),
      );
      ring.position.copy(mPos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      (ring as unknown as { __phase: number }).__phase = (k / 3) * Math.PI * 2;
      globe.add(ring);
      pulseRings.push(ring);
    }

    // BBox region outline
    if (site.bbox) {
      const outlinePts = bboxToGlobeOutline(site.bbox, GLOBE_RADIUS * 1.003);
      globe.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(outlinePts),
          new THREE.LineBasicMaterial({
            color:       COL.marker,
            transparent: true,
            opacity:     0.5,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
          }),
        ),
      );

      // Filled region highlight
      const fillPts    = bboxToGlobeOutline(site.bbox, GLOBE_RADIUS * 1.002, 8);
      const center     = latLngToVec3(site.lat, site.lng, GLOBE_RADIUS * 1.002);
      const fillVerts: number[] = [];
      for (let i = 0; i < fillPts.length - 1; i++) {
        fillVerts.push(center.x, center.y, center.z);
        fillVerts.push(fillPts[i].x, fillPts[i].y, fillPts[i].z);
        fillVerts.push(fillPts[i + 1].x, fillPts[i + 1].y, fillPts[i + 1].z);
      }
      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(fillVerts, 3));
      globe.add(
        new THREE.Mesh(
          fillGeo,
          new THREE.MeshBasicMaterial({
            color:       COL.marker,
            transparent: true,
            opacity:     0.08,
            side:        THREE.DoubleSide,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
          }),
        ),
      );

      // Corner dots
      const corners = [
        [site.bbox[0], site.bbox[1]],
        [site.bbox[2], site.bbox[1]],
        [site.bbox[2], site.bbox[3]],
        [site.bbox[0], site.bbox[3]],
      ];
      const cornerPos: number[] = [];
      for (const [lng, lat] of corners) {
        const v = latLngToVec3(lat, lng, GLOBE_RADIUS * 1.004);
        cornerPos.push(v.x, v.y, v.z);
      }
      const cornerGeo = new THREE.BufferGeometry();
      cornerGeo.setAttribute("position", new THREE.Float32BufferAttribute(cornerPos, 3));
      globe.add(
        new THREE.Points(
          cornerGeo,
          new THREE.PointsMaterial({
            color:       COL.marker,
            size:        0.012,
            transparent: true,
            opacity:     0.8,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
          }),
        ),
      );
    }
  }

  return pulseRings;
}

/* ── Background stars ─────────────────────────────────────────── */

export function buildStars(scene: THREE.Scene) {
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r  = 12 + Math.random() * 40;
    starPos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph);
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color:          0x556688,
        size:           0.04,
        transparent:    true,
        opacity:        0.25,
        sizeAttenuation: true,
        depthWrite:     false,
      }),
    ),
  );
}

/* ── Equatorial orbit ring ────────────────────────────────────── */

export function buildOrbitRing(globe: THREE.Group) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    const r = GLOBE_RADIUS * 1.35;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  globe.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color:       COL.mesh,
        transparent: true,
        opacity:     0.04,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
      }),
    ),
  );
}
