export interface Manifest {
  id: string;
  name?: string;
  description?: string;
  assets: Asset[];
}

export interface Asset {
  id: string;
  assetType: 'ortho' | 'terrain_dsm' | 'terrain_dtm' | 'point_cloud' | 'vector' | 'site_model';
  format: 'xyz' | 'terrain-rgb' | 'quantized-mesh' | 'laz' | '3dtiles' | 'geojson' | 'glb';
  url: string;
  crs?: string;
  bbox?: number[];
  lod?: number;
  byteSize?: number;
  checksum?: string;
}
