"use client";

import React, { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}

const CesiumViewer: React.FC = () => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  useEffect(() => {
    if (!cesiumContainerRef.current) return;

    // Set Cesium base URL
    window.CESIUM_BASE_URL = "/cesium";

    // Set default token
    Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

    // Initialize the viewer
    const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
    });

    viewerRef.current = viewer;

    const loadDataset = async () => {
      try {
        // Load a sample photogrammetry tileset (e.g., Google Photorealistic 3D Tiles: 2275207)
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(2275207);

        // React StrictMode might unmount and destroy the viewer while we're fetching the tileset
        if (viewer.isDestroyed()) return;

        // Apply performance settings
        tileset.maximumScreenSpaceError = 16;
        tileset.skipLevelOfDetail = true;
        tileset.dynamicScreenSpaceError = true;

        viewer.scene.primitives.add(tileset);

        // Zoom camera to the dataset
        await viewer.zoomTo(tileset);
      } catch (error) {
        console.error("Error loading Cesium 3D Tileset:", error);
      }
    };

    loadDataset();

    // Cleanup on unmount
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  return <div ref={cesiumContainerRef} style={{ width: "100%", height: "100vh" }} />;
};

export default CesiumViewer;
