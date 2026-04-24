export interface Manifest {
  schemaVersion?: string;
  id: string;
  name?: string;
  description?: string;
  assets: Asset[];
  bounds?: Bounds;
  processingCrs?: string;
  verticalDatum?: string;
  siteId?: string;
  surveyId?: string;
  capturedAt?: string;
  rendering?: RenderingDefaults;
  anchors?: Anchor[];
  /** Per-processor status for non-completed assets (pending, running, failed, timed_out). */
  assetStatuses?: AssetStatus[];
}

export interface AssetStatus {
  processorType: string;
  status: 'pending' | 'running' | 'failed' | 'timed_out' | 'cancelled';
  error?: string;
}

export interface Asset {
  id: string;
  assetType: 'ortho' | 'terrain_dsm' | 'terrain_dtm' | 'point_cloud' | 'vector' | 'site_model' | 'heatmap' | 'contours';
  format: 'xyz' | 'terrain-rgb' | 'quantized-mesh' | 'laz' | '3dtiles' | 'copc' | 'geojson' | 'glb';
  url: string;
  crs?: string;
  bbox?: number[];
  lod?: number;
  byteSize?: number;
  checksum?: string;
  minZoom?: number;
  maxZoom?: number;
  zRange?: number[];
  name?: string;
  role?: string;
  /** V-TRUST-01 — per-survey terrain RMSE (metres, vertical). Feeds the
   *  volume card's ± 95 % CI band when set; falls back to the env-driven
   *  default in `lib/viewer/terrainRmse.ts` when omitted. Populated by
   *  asset-svc once the Sprint-2 BE migration lands. */
  rmse_m?: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Anchor {
  name: string;
  longitude: number;
  latitude: number;
  height?: number;
}

export interface RenderingDefaults {
  terrainExaggeration?: number;
  suggestedViewHeightScale?: number;
  pointCloud?: PointCloudRenderingDefaults;
}

export interface PointCloudRenderingDefaults {
  eyeDomeLighting?: boolean;
  eyeDomeLightingStrength?: number;
}
