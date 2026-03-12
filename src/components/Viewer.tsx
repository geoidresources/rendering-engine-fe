import React, { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import type { MapViewState } from '@deck.gl/core';
import { Map } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { TileLayer, TerrainLayer } from '@deck.gl/geo-layers';
import type { GeoBoundingBox } from '@deck.gl/geo-layers';
import { BitmapLayer, GeoJsonLayer, PointCloudLayer } from '@deck.gl/layers';
import { LASWorkerLoader } from '@loaders.gl/las';

import { useViewerStore } from '../store/viewerStore';
import { LayerPanel } from './LayerPanel';
import { Toolbar } from './Toolbar';
import { InspectorPanel } from './InspectorPanel';

const INITIAL_VIEW_STATE = {
  longitude: -97.1700818,
  latitude: 33.2275135,
  zoom: 14,
  maxZoom: 20,
  pitch: 30,
  bearing: 0
};

export default function Viewer() {
  const { layers, setViewState, setSelectedFeature } = useViewerStore();

  const deckLayers = useMemo(() => {
    const activeLayers = [];

    // 1. Orthomosaic (TileLayer with BitmapLayer)
    if (layers.ortho.visible) {
      activeLayers.push(
        new TileLayer({
          id: 'ortho-layer',
          data: 'http://localhost:8080/assets/ortho_tiles/{z}/{x}/{y}.png',
          minZoom: 0,
          maxZoom: 18,
          tileSize: 256,
          opacity: layers.ortho.opacity,
          onTileError: () => {},
          renderSubLayers: (props) => {
            const { west, south, east, north } = props.tile.bbox as GeoBoundingBox;

            return new BitmapLayer(props, {
              data: undefined,
              image: props.data,
              bounds: [west, south, east, north]
            });
          }
        })
      );
    }

    // 2. Point Cloud (LAZ)
    if (layers.laz.visible) {
      activeLayers.push(
        new PointCloudLayer({
          id: 'laz-layer',
          data: 'http://localhost:8080/assets/pointclouds/site_v12.laz',
          loaders: [LASWorkerLoader],
          opacity: layers.laz.opacity,
          pointSize: 2,
          getColor: [255, 255, 255], // Will be overridden by loader if RGB exists
          pickable: false,
          onHover: () => {
            // Optional: hover logic
          }
        })
      );
    }

    // 3. Polygons (GeoJSON FeatureCollection)
    if (layers.polygons.visible) {
      activeLayers.push(
        new GeoJsonLayer({
          id: 'polygon-layer',
          data: 'http://localhost:8080/assets/vectors/regions.geojson',
          opacity: layers.polygons.opacity,
          pickable: true,
          stroked: true,
          filled: true,
          extruded: false,
          lineWidthMinPixels: 2,
          getFillColor: [255, 0, 0, 80],
          getLineColor: [255, 0, 0, 255],
          onClick: (info) => {
            if (info.object) {
              setSelectedFeature(info.object);
            } else {
              setSelectedFeature(null);
            }
          }
        })
      );
    }

    // 4. DSM Terrain (Mapbox RGB-encoded elevation tiles)
    if (layers.dsm.visible) {
      activeLayers.push(
        new TerrainLayer({
          id: 'dsm-layer',
          elevationDecoder: {
            rScaler: 6553.6,
            gScaler: 25.6,
            bScaler: 0.1,
            offset: -10000
          },
          elevationData: 'http://localhost:8080/assets/terrain_rgb/{z}/{x}/{y}.png',
          texture: 'http://localhost:8080/assets/ortho_tiles/{z}/{x}/{y}.png',
          onTileError: () => {},
          opacity: layers.dsm.opacity,
          maxZoom: 18
        })
      );
    }

    return activeLayers;
  }, [layers, setSelectedFeature]);

  return (
    <div className="relative w-full h-screen overflow-hidden flex bg-gray-100">
      {/* Left Panel */}
      <LayerPanel />

      {/* Main Viewer Area */}
      <div className="flex-1 relative">
        <Toolbar />
        
        <DeckGL
          initialViewState={INITIAL_VIEW_STATE}
          controller={true}
          layers={deckLayers}
          onViewStateChange={({ viewState }) => {
              const { longitude, latitude, zoom, pitch = 0, bearing = 0 } = viewState as MapViewState;
              setViewState({ longitude, latitude, zoom, pitch, bearing });
            }}
          onClick={(info) => {
            if (!info.object) {
              setSelectedFeature(null);
            }
          }}
        >
          <Map
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            reuseMaps
          />
        </DeckGL>

        {/* Right Panel */}
        <InspectorPanel />
      </div>
    </div>
  );
}
