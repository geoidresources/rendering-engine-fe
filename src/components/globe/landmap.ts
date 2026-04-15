import type { Topology, GeometryCollection } from "topojson-specification";
import { feature } from "topojson-client";

/* ── Build an off-screen canvas with land pixels white ─────── */

export async function buildLandCanvas(): Promise<ImageData> {
  const res  = await fetch("/data/land-110m.json");
  const topo = (await res.json()) as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land);

  const W = 1024;
  const H = 512;
  const cvs = document.createElement("canvas");
  cvs.width  = W;
  cvs.height = H;
  const ctx  = cvs.getContext("2d")!;

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

/* ── Point-in-land test using the canvas bitmap ─────────────── */

export function isLand(img: ImageData, lat: number, lng: number): boolean {
  const x = Math.floor(((lng + 180) / 360) * img.width)  % img.width;
  const y = Math.floor(((90 - lat)  / 180) * img.height) % img.height;
  return img.data[(y * img.width + x) * 4] > 128;
}
