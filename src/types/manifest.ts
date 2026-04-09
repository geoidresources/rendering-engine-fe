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
}

export interface Asset {
  id: string;
  assetType: 'ortho' | 'terrain_dsm' | 'terrain_dtm' | 'point_cloud' | 'vector' | 'site_model' | 'heatmap' | 'contours';
  format: 'xyz' | 'terrain-rgb' | 'quantized-mesh' | 'laz' | '3dtiles' | 'geojson' | 'glb';
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
