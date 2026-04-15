export interface SiteLocationProp {
  lat: number;
  lng: number;
  name?: string;
  bbox?: [number, number, number, number];
}

export interface GlobeSceneProps {
  /** One or more project sites to render on the globe. */
  sites?: SiteLocationProp[];
  className?: string;
}
