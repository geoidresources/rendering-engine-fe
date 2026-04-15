"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { useViewerStore } from "@/store/viewerStore";
import { ProjectPlacard } from "@/app/project/sidebar/ProjectPlacard";

/* ── Constants ─────────────────────────────────────────── */

const GLOBE_RADIUS = 1.0;
const DOT_COUNT = 28000;
const OCEAN_SAMPLE_RATE = 0.06;
const MESH_NODE_COUNT = 50;
const MESH_EDGE_THRESHOLD = 0.75;
const ARC_COUNT = 8;
const ROTATION_SPEED = 0.0006;
const STAR_COUNT = 1500;

const COL = {
  land: [1.0, 0.65, 0.2] as const,       // amber/orange
  landDim: [0.6, 0.4, 0.12] as const,     // dimmer amber
  ocean: [0.15, 0.2, 0.35] as const,      // deep blue-grey
  arc: new THREE.Color(0.25, 0.55, 0.9),   // cyan-blue
  mesh: new THREE.Color(0.3, 0.4, 0.55),   // grey-blue
  meshNode: new THREE.Color(0.5, 0.6, 0.7),
  glow: new THREE.Color(0.08, 0.18, 0.4),  // deep blue
  marker: new THREE.Color(1.0, 0.55, 0.1), // orange
  ring: new THREE.Color(1.0, 0.6, 0.15),
};

/* ── Geometry helpers ──────────────────────────────────── */

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/** Fibonacci sphere — near-uniform point distribution on a sphere. */
function fibSphere(n: number) {
  const pts: { x: number; y: number; z: number; lat: number; lng: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
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

/* ── World-map canvas for land detection ───────────────── */

async function buildLandCanvas(): Promise<ImageData> {
  const res = await fetch("/data/land-110m.json");
  const topo = (await res.json()) as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);

  const W = 1024;
  const H = 512;
  const cvs = document.createElement("canvas");
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext("2d")!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";

  const drawRings = (rings: number[][][]) => {
    for (const ring of rings) {
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const px = ((ring[i][0] + 180) / 360) * W;
        const py = ((90 - ring[i][1]) / 180) * H;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  };

  const geom = (land as any).geometry ?? (land as any).features?.[0]?.geometry;
  if (geom?.type === "MultiPolygon") {
    for (const poly of geom.coordinates) drawRings(poly);
  } else if (geom?.type === "Polygon") {
    drawRings(geom.coordinates);
  }
  // FeatureCollection path
  if ((land as any).features) {
    for (const feat of (land as any).features) {
      const g = feat.geometry;
      if (g.type === "MultiPolygon") for (const p of g.coordinates) drawRings(p);
      else if (g.type === "Polygon") drawRings(g.coordinates);
    }
  }

  return ctx.getImageData(0, 0, W, H);
}

function isLand(img: ImageData, lat: number, lng: number): boolean {
  const x = Math.floor(((lng + 180) / 360) * img.width) % img.width;
  const y = Math.floor(((90 - lat) / 180) * img.height) % img.height;
  return img.data[(y * img.width + x) * 4] > 128;
}

/* ── Arc geometry (quadratic Bezier on the sphere) ─────── */

function arcGeom(a: THREE.Vector3, b: THREE.Vector3, lift: number) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.normalize().multiplyScalar(GLOBE_RADIUS + lift);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
}

/* ── Region outline on the globe surface ───────────────── */

function bboxToGlobeOutline(
  bbox: [number, number, number, number],
  r: number,
  segments = 24,
): THREE.Vector3[] {
  const [west, south, east, north] = bbox;
  const pts: THREE.Vector3[] = [];
  // bottom edge: south, west→east
  for (let i = 0; i <= segments; i++)
    pts.push(latLngToVec3(south, west + ((east - west) * i) / segments, r));
  // right edge: east, south→north
  for (let i = 1; i <= segments; i++)
    pts.push(latLngToVec3(south + ((north - south) * i) / segments, east, r));
  // top edge: north, east→west
  for (let i = 1; i <= segments; i++)
    pts.push(latLngToVec3(north, east - ((east - west) * i) / segments, r));
  // left edge: west, north→south
  for (let i = 1; i <= segments; i++)
    pts.push(latLngToVec3(north - ((north - south) * i) / segments, west, r));
  pts.push(pts[0].clone()); // close the loop
  return pts;
}

/* ── Component ─────────────────────────────────────────── */

export interface SiteLocationProp {
  lat: number;
  lng: number;
  name?: string;
  bbox?: [number, number, number, number];
}

interface Props {
  /** One or more project sites to render on the globe. */
  sites?: SiteLocationProp[];
  className?: string;
}

export default function GlobeScene({
  sites = [],
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const disposeRef = useRef<(() => void) | null>(null);

  // Imperative handle: tween the globe's quaternion so a lat/lng faces camera.
  const flyToLatLngRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const flyToTarget = useViewerStore((s) => s.flyToTarget);
  const focusedProject = useViewerStore((s) => s.focusedProject);
  const setFocusedProject = useViewerStore((s) => s.setFocusedProject);

  // ── Per-frame marker tracking (fixes parallax drift) ────────────────────
  // isTrackingRef: set true when a project is clicked, false when cleared.
  const isTrackingRef = useRef(false);
  // Called by the Three.js RAF loop every frame with current screen (x, y).
  // Directly mutates SVG element attributes — no React re-renders needed.
  const markerUpdateCallbackRef = useRef<((x: number, y: number) => void) | null>(null);

  // SVG element refs
  const svgGroupRef = useRef<SVGGElement>(null);   // outer group (controls visibility)
  const svgLineRef = useRef<SVGLineElement>(null); // leader line
  const dotGroupRef = useRef<SVGGElement>(null);   // pulsing dot
  const gradientRef = useRef<SVGLinearGradientElement>(null); // gradient for line

  // Card container ref (used to compute line endpoint from card's bounding rect)
  const cardContainerRef = useRef<HTMLDivElement>(null);
  // Cached card anchor (bottom-left corner of card in canvas coords).
  // Computed once when card mounts, recomputed on resize.
  const cachedCardAnchorRef = useRef<{ x: number; y: number } | null>(null);

  // Compute card anchor after card renders (or on resize).
  useLayoutEffect(() => {
    if (!focusedProject) {
      cachedCardAnchorRef.current = null;
      return;
    }
    const compute = () => {
      if (!cardContainerRef.current || !mountRef.current) return;
      const canvasR = mountRef.current.getBoundingClientRect();
      const cardR = cardContainerRef.current.getBoundingClientRect();
      // Target the bottom-left corner of the card: line exits card going down-left.
      cachedCardAnchorRef.current = {
        x: cardR.left - canvasR.left,
        y: cardR.bottom - canvasR.top,
      };
    };
    // Defer one rAF so the card has been painted before we measure it.
    const handle = requestAnimationFrame(compute);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(handle);
      window.removeEventListener("resize", compute);
    };
  // Only re-run when the focused project id changes, not every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedProject?.id]);

  // Set up the per-frame marker update callback whenever focusedProject changes.
  useEffect(() => {
    if (!focusedProject) {
      isTrackingRef.current = false;
      markerUpdateCallbackRef.current = null;
      // Hide SVG overlay
      if (svgGroupRef.current) svgGroupRef.current.setAttribute("opacity", "0");
      return;
    }
    // Hide until first valid position arrives (avoids (0,0) flash).
    if (svgGroupRef.current) svgGroupRef.current.setAttribute("opacity", "0");

    markerUpdateCallbackRef.current = (sx: number, sy: number) => {
      // Reveal on first valid frame
      const grp = svgGroupRef.current;
      if (grp && grp.getAttribute("opacity") !== "1") {
        grp.setAttribute("opacity", "1");
      }
      // Move dot
      if (dotGroupRef.current) {
        dotGroupRef.current.setAttribute("transform", `translate(${sx},${sy})`);
      }
      // Update leader line + gradient endpoints
      const anchor = cachedCardAnchorRef.current;
      if (svgLineRef.current && anchor) {
        svgLineRef.current.setAttribute("x1", String(sx));
        svgLineRef.current.setAttribute("y1", String(sy));
        svgLineRef.current.setAttribute("x2", String(anchor.x));
        svgLineRef.current.setAttribute("y2", String(anchor.y));
      }
      if (gradientRef.current && anchor) {
        gradientRef.current.setAttribute("x1", String(sx));
        gradientRef.current.setAttribute("y1", String(sy));
        gradientRef.current.setAttribute("x2", String(anchor.x));
        gradientRef.current.setAttribute("y2", String(anchor.y));
      }
    };
  }, [focusedProject]);

  useEffect(() => {
    if (!flyToTarget || !flyToLatLngRef.current) return;
    flyToLatLngRef.current(flyToTarget.lat, flyToTarget.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToTarget?.requestId]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let dead = false;

    (async () => {
      if (dead || !el) return;
      const W = el.clientWidth || 800;
      const H = el.clientHeight || 600;

      /* ── Three.js boilerplate ── */
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
      camera.position.set(0, 0.2, 3.2);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x020208, 1);
      if (dead) { renderer.dispose(); return; }
      el.appendChild(renderer.domElement);

      const globe = new THREE.Group();
      globe.rotation.x = 0.25; // slight tilt
      scene.add(globe);

      /* ── FlyTo state (tween globe quaternion to bring a lat/lng under the camera) ── */
      let flyActive = false;
      let rotationStopped = false; // permanently stops auto-rotation on first flyTo
      let flyStartTime = 0;
      const FLY_DURATION_MS = 1800;
      const flyStartQuat = new THREE.Quaternion();
      const flyEndQuat = new THREE.Quaternion();

      // Compute the quaternion that brings latLngToVec3(lat,lng) onto the +Z axis
      // (directly facing the camera), preserving a small tilt so the point sits
      // slightly below centre — matches the camera's 0.2 y-offset.
      const computeTargetQuat = (lat: number, lng: number) => {
        const p = latLngToVec3(lat, lng, 1).normalize();
        const facing = new THREE.Vector3(0, 0, 1);
        const base = new THREE.Quaternion().setFromUnitVectors(p, facing);
        // Lean slightly so the spot is a touch below dead-centre (aesthetic tilt).
        const tilt = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          0.18,
        );
        return tilt.multiply(base);
      };

      // Stores the in-flight target so screen-pos can be computed after tween.
      let flyTargetLat = 0;
      let flyTargetLng = 0;

      flyToLatLngRef.current = (lat: number, lng: number) => {
        flyTargetLat = lat;
        flyTargetLng = lng;
        isTrackingRef.current = true; // start per-frame marker tracking immediately
        flyStartQuat.copy(globe.quaternion);
        flyEndQuat.copy(computeTargetQuat(lat, lng));
        flyStartTime = performance.now();
        flyActive = true;
        rotationStopped = true;
      };

      /* ── Load world map ── */
      let landImg: ImageData | null = null;
      try {
        landImg = await buildLandCanvas();
      } catch {
        console.warn("Globe: world-map data unavailable, using fallback");
      }
      if (dead) { renderer.dispose(); return; }

      /* ── Dot globe ── */
      const pts = fibSphere(DOT_COUNT);
      const pos: number[] = [];
      const sizes: number[] = [];
      const alphas: number[] = [];
      const colors: number[] = [];
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
      dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      dotGeo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
      dotGeo.setAttribute("alpha", new THREE.Float32BufferAttribute(alphas, 1));
      dotGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

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
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      globe.add(new THREE.Points(dotGeo, dotMat));

      /* ── Outer constellation mesh ── */
      const meshR = GLOBE_RADIUS * 1.18;
      const meshNodes: THREE.Vector3[] = [];
      const meshPosArr: number[] = [];
      for (let i = 0; i < MESH_NODE_COUNT; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const v = new THREE.Vector3(
          meshR * Math.sin(ph) * Math.cos(th),
          meshR * Math.cos(ph),
          meshR * Math.sin(ph) * Math.sin(th),
        );
        meshNodes.push(v);
        meshPosArr.push(v.x, v.y, v.z);
      }

      // nodes
      const mnGeo = new THREE.BufferGeometry();
      mnGeo.setAttribute("position", new THREE.Float32BufferAttribute(meshPosArr, 3));
      globe.add(
        new THREE.Points(
          mnGeo,
          new THREE.PointsMaterial({
            color: COL.meshNode,
            size: 0.018,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      );

      // edges (connect nearby nodes → triangulation look)
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
              color: COL.mesh,
              transparent: true,
              opacity: 0.12,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          ),
        );
      }

      /* ── Connection arcs ── */
      if (landVecs.length > 20) {
        const arcMat = new THREE.LineBasicMaterial({
          color: COL.arc,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        for (let i = 0; i < ARC_COUNT; i++) {
          let a = Math.floor(Math.random() * landVecs.length);
          let b = Math.floor(Math.random() * landVecs.length);
          // ensure they're far enough apart for a visible arc
          let tries = 0;
          while (landVecs[a].distanceTo(landVecs[b]) < 0.8 && tries++ < 30) {
            b = Math.floor(Math.random() * landVecs.length);
          }
          globe.add(new THREE.Line(arcGeom(landVecs[a], landVecs[b], 0.15 + Math.random() * 0.25), arcMat.clone()));
        }
      }

      /* ── Atmosphere glow (thin outer rim only) ── */
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
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      globe.add(new THREE.Mesh(glowGeo, glowMat));

      /* ── Site markers + bbox region highlights ── */
      const pulseRings: THREE.Mesh[] = [];

      for (const site of sites) {
        const mPos = latLngToVec3(site.lat, site.lng, GLOBE_RADIUS * 1.005);

        // core glowing dot
        const coreMat = new THREE.MeshBasicMaterial({ color: COL.marker });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 12), coreMat);
        core.position.copy(mPos);
        globe.add(core);

        // concentric pulse rings (3 rings at different phases)
        for (let k = 0; k < 3; k++) {
          const ringMat = new THREE.MeshBasicMaterial({
            color: COL.ring,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 48), ringMat);
          ring.position.copy(mPos);
          ring.lookAt(new THREE.Vector3(0, 0, 0));
          (ring as any).__phase = (k / 3) * Math.PI * 2;
          globe.add(ring);
          pulseRings.push(ring);
        }

        // bbox region outline (glowing rectangle on the globe surface)
        if (site.bbox) {
          const outlinePts = bboxToGlobeOutline(site.bbox, GLOBE_RADIUS * 1.003);
          const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
          globe.add(
            new THREE.Line(
              outlineGeo,
              new THREE.LineBasicMaterial({
                color: COL.marker,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
              }),
            ),
          );

          // filled region highlight (subtle glow fill)
          const fillPts = bboxToGlobeOutline(site.bbox, GLOBE_RADIUS * 1.002, 8);
          const fillGeo = new THREE.BufferGeometry();
          const center = latLngToVec3(site.lat, site.lng, GLOBE_RADIUS * 1.002);
          const fillVerts: number[] = [];
          for (let i = 0; i < fillPts.length - 1; i++) {
            fillVerts.push(center.x, center.y, center.z);
            fillVerts.push(fillPts[i].x, fillPts[i].y, fillPts[i].z);
            fillVerts.push(fillPts[i + 1].x, fillPts[i + 1].y, fillPts[i + 1].z);
          }
          fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(fillVerts, 3));
          globe.add(
            new THREE.Mesh(
              fillGeo,
              new THREE.MeshBasicMaterial({
                color: COL.marker,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
              }),
            ),
          );

          // bright corner dots
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
                color: COL.marker,
                size: 0.012,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
              }),
            ),
          );
        }
      }

      /* ── Background stars ── */
      const starPos = new Float32Array(STAR_COUNT * 3);
      for (let i = 0; i < STAR_COUNT; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const r = 12 + Math.random() * 40;
        starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        starPos[i * 3 + 1] = r * Math.cos(ph);
        starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      scene.add(
        new THREE.Points(
          starGeo,
          new THREE.PointsMaterial({
            color: 0x556688,
            size: 0.04,
            transparent: true,
            opacity: 0.25,
            sizeAttenuation: true,
            depthWrite: false,
          }),
        ),
      );

      /* ── Subtle equatorial ring (orbit line) ── */
      const orbitPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        const r = GLOBE_RADIUS * 1.35;
        orbitPts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
      globe.add(
        new THREE.Line(
          orbitGeo,
          new THREE.LineBasicMaterial({
            color: COL.mesh,
            transparent: true,
            opacity: 0.04,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      );

      /* ── Animation ── */
      let t = 0;
      // easeInOutCubic — smooth in & out for the flyTo tween.
      const easeInOut = (k: number) =>
        k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

      const applyFlyTween = () => {
        if (!flyActive) {
          if (!rotationStopped) globe.rotation.y += ROTATION_SPEED;
          return;
        }
        const elapsed = performance.now() - flyStartTime;
        const k = Math.min(1, elapsed / FLY_DURATION_MS);
        const eased = easeInOut(k);
        globe.quaternion.slerpQuaternions(flyStartQuat, flyEndQuat, eased);
        if (k >= 1) flyActive = false;
      };

      // Helper: project flyTarget lat/lng → screen (x,y) and push to callback.
      // Called every frame when isTrackingRef is true so the SVG dot/line
      // always matches the rendered marker position (incl. during parallax).
      const updateMarkerScreenPos = () => {
        if (!isTrackingRef.current || !markerUpdateCallbackRef.current) return;
        const p = latLngToVec3(flyTargetLat, flyTargetLng, GLOBE_RADIUS * 1.008)
          .clone()
          .applyMatrix4(globe.matrixWorld);
        p.project(camera);
        markerUpdateCallbackRef.current(
          ((p.x + 1) / 2) * el.clientWidth,
          ((-p.y + 1) / 2) * el.clientHeight,
        );
      };

      const animate = () => {
        if (dead) return;
        rafRef.current = requestAnimationFrame(animate);
        t += 0.016;

        applyFlyTween();

        // pulse rings expand + fade
        for (const ring of pulseRings) {
          const phase = (ring as any).__phase as number;
          const cycle = ((t * 1.2 + phase) % (Math.PI * 2)) / (Math.PI * 2);
          const s = 1 + cycle * 3.5;
          ring.scale.set(s, s, s);
          (ring.material as THREE.MeshBasicMaterial).opacity = (1 - cycle) * 0.45;
        }

        renderer.render(scene, camera);
        // Update after render so globe.matrixWorld is fresh for this frame.
        updateMarkerScreenPos();
      };
      animate();

      /* ── Resize ── */
      const onResize = () => {
        if (dead || !el) return;
        const w = el.clientWidth;
        const h = el.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      /* ── Mouse interaction: subtle parallax ── */
      let mouseX = 0;
      let mouseY = 0;
      const onMouse = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("mousemove", onMouse);

      // apply parallax in animation
      const animateWithParallax = () => {
        if (dead) return;
        rafRef.current = requestAnimationFrame(animateWithParallax);
        t += 0.016;

        applyFlyTween();

        // subtle camera parallax
        camera.position.x += (mouseX * 0.15 - camera.position.x) * 0.02;
        camera.position.y += (0.2 + mouseY * -0.1 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, 0);

        for (const ring of pulseRings) {
          const phase = (ring as any).__phase as number;
          const cycle = ((t * 1.2 + phase) % (Math.PI * 2)) / (Math.PI * 2);
          const s = 1 + cycle * 3.5;
          ring.scale.set(s, s, s);
          (ring.material as THREE.MeshBasicMaterial).opacity = (1 - cycle) * 0.45;
        }

        renderer.render(scene, camera);
        // Same per-frame tracking — captures parallax camera shift too.
        updateMarkerScreenPos();
      };
      // cancel basic loop and start parallax loop
      cancelAnimationFrame(rafRef.current);
      animateWithParallax();

      /* ── Cleanup ── */
      disposeRef.current = () => {
        dead = true;
        flyToLatLngRef.current = null;
        markerUpdateCallbackRef.current = null;
        isTrackingRef.current = false;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("mousemove", onMouse);
        cancelAnimationFrame(rafRef.current);
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
            else m.material.dispose();
          }
        });
        renderer.dispose();
        if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      };
    })();

    return () => {
      if (disposeRef.current) disposeRef.current();
    };
  }, [sites]);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#020208] ${className ?? ""}`}>
      {/* Three.js canvas mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* ── HUD overlay ── */}
      <div className="absolute inset-0 pointer-events-none select-none">

        {/* ── SVG leader line + pulsing dot ───────────────────────────────
            Both are updated imperatively every RAF frame via markerUpdateCallbackRef
            so they track the globe marker exactly, including during parallax shift. */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ overflow: "visible", zIndex: 25 }}
        >
          <defs>
            {/* Gradient direction updated per-frame via gradientRef */}
            <linearGradient
              id="gs-leader-grad"
              ref={gradientRef}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="rgba(245,210,89,0.85)" />
              <stop offset="60%" stopColor="rgba(245,210,89,0.35)" />
              <stop offset="100%" stopColor="rgba(245,210,89,0.1)" />
            </linearGradient>
          </defs>

          {/* Group — starts hidden, revealed by first valid frame update */}
          <g ref={svgGroupRef} opacity="0">
            {/* Leader line from dot → card bottom-left */}
            <line
              ref={svgLineRef}
              stroke="url(#gs-leader-grad)"
              strokeWidth="1"
              strokeDasharray="5 3"
              strokeLinecap="round"
            />

            {/* Pulsing marker dot (transform set per-frame) */}
            <g ref={dotGroupRef}>
              {/* Outer slow pulse */}
              <circle r="14" fill="rgba(245,210,89,0.04)">
                <animate
                  attributeName="r"
                  values="10;18;10"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.15;0;0.15"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Middle ring */}
              <circle
                r="7"
                fill="rgba(245,210,89,0.08)"
                stroke="rgba(245,210,89,0.45)"
                strokeWidth="0.75"
              />
              {/* Core dot */}
              <circle
                r="3.5"
                fill="rgba(245,210,89,0.95)"
                filter="drop-shadow(0 0 4px rgba(245,210,89,0.8))"
              />
            </g>
          </g>
        </svg>

        {/* ── Project info card — top-right ─────────────────────────────── */}
        <AnimatePresence>
          {focusedProject && (
            <motion.div
              key="card-wrapper"
              className="absolute top-6 right-6 z-30 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ProjectPlacard
                ref={cardContainerRef}
                project={focusedProject}
                onClose={() => setFocusedProject(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Top-left branding */}
        <div className="absolute top-6 left-8 flex items-baseline gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.35em] text-white/50">
            GEOID
          </span>
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-sky-400/30">
            Spatial Intelligence
          </span>
        </div>

        {/* Top-right: thin decorative lines */}
        <div className="absolute top-6 right-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-white/10" />
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500/30" />
          </div>
        </div>

        {/* Center crosshair (very subtle) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <line x1="30" y1="8" x2="30" y2="22" stroke="white" strokeWidth="0.5" />
            <line x1="30" y1="38" x2="30" y2="52" stroke="white" strokeWidth="0.5" />
            <line x1="8" y1="30" x2="22" y2="30" stroke="white" strokeWidth="0.5" />
            <line x1="38" y1="30" x2="52" y2="30" stroke="white" strokeWidth="0.5" />
            <circle cx="30" cy="30" r="12" stroke="white" strokeWidth="0.3" fill="none" />
          </svg>
        </div>

        {/* Bottom-right: site list */}
        {sites.length > 0 && (
          <div className="absolute bottom-8 right-8 text-right flex flex-col gap-3">
            {sites.map((s, i) => (
              <div key={i}>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400/50 mb-0.5">
                  {s.name ?? "Site"}
                </p>
                <p className="text-[9px] font-mono text-white/20">
                  {Math.abs(s.lat).toFixed(4)}&deg;{s.lat >= 0 ? "N" : "S"}{" "}
                  {Math.abs(s.lng).toFixed(4)}&deg;{s.lng >= 0 ? "E" : "W"}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Bottom-left: decorative element */}
        <div className="absolute bottom-8 left-8">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-amber-500/40 animate-pulse" />
            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/15">
              Live
            </span>
          </div>
        </div>

        {/* Gradient vignette for depth */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(2,2,8,0.5) 100%)",
          }}
        />
      </div>
    </div>
  );
}
