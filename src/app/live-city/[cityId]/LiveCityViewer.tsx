"use client";

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["CESIUM_BASE_URL"] =
    typeof CESIUM_BASE_URL !== "undefined" ? CESIUM_BASE_URL : "/cesiumStatic";
}

import { useEffect, useRef, useState } from "react";
import { useCityTwin } from "@/hooks/useCityTwin";
import { listConversions, triggerConversion } from "@/lib/api/cityTwinApi";
import { ConversionProgressPanel } from "@/components/citytwin/ConversionProgressPanel";
import { CityTwinLayersPanel } from "@/components/citytwin/CityTwinLayersPanel";
import { absolutizeProxiedUrl, bearerHeader } from "@/lib/citytwin/proxy";
import { useCityTwinViewerStore } from "@/store/cityTwinViewerStore";
import { useCityTwinTerrain } from "@/hooks/useCityTwinTerrain";
import { useCityTwinOrthoLayer } from "@/hooks/useCityTwinOrthoLayer";
import { useCityTwinPointsLayer } from "@/hooks/useCityTwinPointsLayer";
import { useCityTwinVectorLayer } from "@/hooks/useCityTwinVectorLayer";
import {
  Viewer as CesiumViewer,
  Cesium3DTileset,
  Cartesian2,
  Cartesian3,
  Color,
  EllipsoidTerrainProvider,
  ImageBasedLighting,
  Ion,
  JulianDate,
  Math as CesiumMath,
  Resource,
  ShadowMode,
  Tonemapper,
  UrlTemplateImageryProvider,
  type ImageryLayer,
} from "cesium";

Ion.defaultAccessToken = "";

// Camera defaults if the twin record lacks center coordinates. Once
// useCityTwin() returns, we override these with twin.center_{lng,lat,height}.
const FALLBACK_LNG = 85.844;
const FALLBACK_LAT = 20.273;
const FALLBACK_HEIGHT = 2500;

export default function LiveCityViewer({ cityId }: { cityId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  // Mirror of viewerRef.current in React state so the per-layer hooks
  // re-run once the imperative Cesium init effect attaches the viewer.
  // Refs alone don't fire deps; without this the hooks would only ever
  // see `null` and never wire their layers.
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  // Status drives the bottom toast.
  //   "loading"     — viewer initialising (briefly on mount)
  //   "ready"       — viewer running, mesh tileset loaded successfully
  //   "no-tileset"  — viewer running, no active mesh conversion to show
  //   "error"       — tileset load failed (auth, 404, malformed JSON, etc.)
  const [status, setStatus] = useState<"loading" | "ready" | "no-tileset" | "error">(
    "loading",
  );

  // Twin metadata + active conversion URLs. The mesh_tileset_url returned
  // by rendering-engine-be is already proxied (and per-tenant scoped).
  const { data: twin } = useCityTwin(cityId);

  // Layer-status dispatcher shared with the four useCityTwin* hooks. The
  // mesh effect below pushes its own transitions through this so the
  // panel's mesh row stays in sync with the same toast we show at the
  // bottom of the screen.
  const setLayerStatus = useCityTwinViewerStore((s) => s.setStatus);
  const meshVisible = useCityTwinViewerStore((s) => s.layers.mesh.visible);

  const [activeConversionId, setActiveConversionId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Discover any conversion already in flight when the page loads so a
  // refresh during a long run resumes the panel instead of dropping it.
  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    listConversions(cityId)
      .then((rows) => {
        if (cancelled) return;
        const inflight = rows.find((r) => r.status === "queued" || r.status === "processing");
        if (inflight) setActiveConversionId(inflight.id);
      })
      .catch(() => {
        // 404 here means either the twin doesn't exist or the user is
        // class=0 — both fine, leave the panel hidden.
      });
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const onConvert = async () => {
    setConvertError(null);
    try {
      const resp = await triggerConversion(cityId);
      setActiveConversionId(resp.conversion_id);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new CesiumViewer(containerRef.current, {
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false as unknown as ImageryLayer,
      requestRenderMode: false,
      shadows: true,
      terrainShadows: ShadowMode.RECEIVE_ONLY,
      msaaSamples: 4,
      contextOptions: {
        webgl: {
          preserveDrawingBuffer: true,
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
        },
      },
    });

    (
      viewer as unknown as { _cesiumWidget: { creditContainer: HTMLElement } }
    )._cesiumWidget.creditContainer.style.display = "none";

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.logarithmicDepthBuffer = true;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#1a2030");
    viewer.terrainProvider = new EllipsoidTerrainProvider();

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.dynamicAtmosphereLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 8.0;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.00012;

    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.brightnessShift = 0.1;
      viewer.scene.skyAtmosphere.saturationShift = 0.05;
    }

    viewer.scene.highDynamicRange = true;
    viewer.scene.postProcessStages.fxaa.enabled = true;

    const stages = viewer.scene.postProcessStages;
    stages.tonemapper = Tonemapper.ACES;

    const ao = stages.ambientOcclusion;
    ao.enabled = true;
    ao.uniforms.intensity = 2.2;
    ao.uniforms.bias = 0.1;
    ao.uniforms.lengthCap = 0.26;
    ao.uniforms.stepSize = 1.6;
    ao.uniforms.frustumLength = 1000.0;
    ao.uniforms.ambientOcclusionOnly = false;

    const bl = stages.bloom;
    bl.enabled = true;
    bl.uniforms.contrast = 120;
    bl.uniforms.brightness = -0.5;
    bl.uniforms.glowOnly = false;
    bl.uniforms.delta = 1.0;
    bl.uniforms.sigma = 2.0;
    bl.uniforms.stepSize = 1.0;

    viewer.clock.currentTime = JulianDate.fromIso8601("2026-05-23T05:30:00Z");
    viewer.clock.shouldAnimate = false;

    const basemap = new UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      minimumLevel: 0,
      maximumLevel: 19,
      credit: "Esri World Imagery",
    });
    viewer.scene.imageryLayers.addImageryProvider(basemap);

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        FALLBACK_LNG,
        FALLBACK_LAT,
        FALLBACK_HEIGHT
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-35),
        roll: 0,
      },
    });

    viewerRef.current = viewer;
    setViewer(viewer);
    // No tileset load here — that's now a separate effect that fires
    // whenever the active mesh URL changes (twin fetch resolves, user
    // activates a new conversion, etc.).
    setStatus("no-tileset");

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
        viewer.resize();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      setViewer(null);
    };
  }, []);

  // Mesh tileset effect — fires whenever the server hands us a new
  // (per-tenant, per-twin) mesh URL. Re-fetches with the current JWT, so
  // the tile bytes flow through rendering-engine-be /city-twins/:slug/mesh/*
  // which enforces JWT + class + tenant on every request.
  const meshTilesetUrl = absolutizeProxiedUrl(twin?.active_conversion?.mesh_tileset_url);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Override camera to the twin's authored centre as soon as we have it.
    if (twin?.center_lng != null && twin?.center_lat != null) {
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(
          twin.center_lng,
          twin.center_lat,
          twin.center_height ?? FALLBACK_HEIGHT,
        ),
        orientation: {
          heading: CesiumMath.toRadians(twin.default_heading ?? 0),
          pitch: CesiumMath.toRadians(twin.default_pitch ?? -35),
          roll: 0,
        },
      });
    }

    if (!meshTilesetUrl) {
      setStatus("no-tileset");
      setLayerStatus("mesh", "idle");
      return;
    }

    let cancelled = false;
    let tileset: Cesium3DTileset | null = null;
    setStatus("loading");
    setLayerStatus("mesh", "loading");

    (async () => {
      try {
        const resource = new Resource({
          url: meshTilesetUrl,
          headers: bearerHeader(),
        });
        tileset = await Cesium3DTileset.fromUrl(resource, {
          maximumScreenSpaceError: 4,
          dynamicScreenSpaceError: false,
          skipLevelOfDetail: false,
          cacheBytes: 1024 * 1024 * 1024,
          maximumCacheOverflowBytes: 512 * 1024 * 1024,
          preloadWhenHidden: true,
          preferLeaves: true,
          shadows: ShadowMode.ENABLED,
          imageBasedLighting: (() => {
            const ibl = new ImageBasedLighting();
            ibl.imageBasedLightingFactor = new Cartesian2(1.0, 1.0);
            return ibl;
          })(),
        });
        if (cancelled || viewer.isDestroyed()) {
          tileset.destroy();
          return;
        }
        // Honour the panel's mesh visibility flag the moment the tileset
        // lands — if the operator turned mesh off before tiles finished
        // downloading, we don't want a flash of geometry.
        tileset.show = meshVisible;
        viewer.scene.primitives.add(tileset);
        await viewer.flyTo(tileset, { duration: 1.5 });
        if (!cancelled) {
          setStatus("ready");
          setLayerStatus("mesh", "ready");
        }
      } catch (err) {
        console.error("[LiveCity] tileset load failed", err);
        if (!cancelled) {
          setStatus("error");
          setLayerStatus(
            "mesh",
            "error",
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (tileset) {
        const ts = tileset;
        const v = viewerRef.current;
        if (v && !v.isDestroyed()) {
          v.scene.primitives.remove(ts); // also destroys
        } else {
          ts.destroy();
        }
      }
    };
    // meshVisible read at attach-time only; subsequent flips are handled
    // by the dedicated visibility sub-effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshTilesetUrl, twin?.center_lng, twin?.center_lat, twin?.center_height, twin?.default_heading, twin?.default_pitch, setLayerStatus]);

  // Mesh visibility — keep the panel checkbox in sync with the live
  // tileset without re-fetching it on every toggle. Walks scene.primitives
  // because the load effect owns the only reference to the tileset and
  // doesn't lift it into state.
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    // The mesh tileset is the only Cesium3DTileset we add from
    // LiveCityViewer itself; point cloud / etc. attach through their own
    // hooks and would also flip on this iteration if we matched too
    // broadly. Constrain to primitives whose URL matches the mesh URL.
    const prims = v.scene.primitives;
    for (let i = 0; i < prims.length; i++) {
      const p = prims.get(i);
      if (p instanceof Cesium3DTileset) {
        const url = (p as unknown as { _url?: string })._url;
        if (url && meshTilesetUrl && url === meshTilesetUrl) {
          p.show = meshVisible;
        }
      }
    }
    v.scene.requestRender();
  }, [meshVisible, meshTilesetUrl]);

  // Compute the four extra layer URLs from the active conversion. We
  // leave the raw (proxied) values in place — each hook calls
  // absolutizeProxiedUrl itself so they don't depend on knowing whether
  // the URL is already absolute.
  const terrainTilesetUrl = twin?.active_conversion?.terrain_tileset_url ?? null;
  const orthoTilesetUrl = twin?.active_conversion?.ortho_tileset_url ?? null;
  const pointsTilesetUrl = twin?.active_conversion?.points_tileset_url ?? null;
  const vectorUrl = twin?.active_conversion?.vector_url ?? null;

  // Per-layer hooks — each owns its own Cesium primitive lifecycle and
  // pushes status to cityTwinViewerStore so the panel reflects reality.
  useCityTwinTerrain(viewer, terrainTilesetUrl);
  useCityTwinOrthoLayer(viewer, orthoTilesetUrl);
  useCityTwinPointsLayer(viewer, pointsTilesetUrl);
  useCityTwinVectorLayer(viewer, vectorUrl);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Layer toggles — top-LEFT, mirrors the visual language of the
          Convert button + progress panel (which live top-RIGHT). */}
      <CityTwinLayersPanel />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-mono text-white/80 backdrop-blur">
            loading city…
          </div>
        </div>
      )}
      {status === "no-tileset" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-mono text-white/70 backdrop-blur">
            no active conversion — run one to render the twin
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full bg-red-900/70 px-4 py-1.5 text-xs font-mono text-red-100 backdrop-blur">
            failed to load mesh tileset — check console
          </div>
        </div>
      )}

      {/* Convert button — hidden once a run is active and the panel takes over */}
      {twin && !activeConversionId && (
        <div className="pointer-events-auto absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
          <button
            onClick={onConvert}
            className="rounded-md border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90"
          >
            ▶ Run conversion
          </button>
          {convertError && (
            <div className="rounded-md bg-red-900/70 px-2 py-1 text-[10px] text-red-100">
              {convertError}
            </div>
          )}
        </div>
      )}

      {/* Live progress panel — mounts on a conversion id, polls every 1.5 s,
          auto-stops on terminal stage. Close button clears the local state. */}
      {activeConversionId && (
        <ConversionProgressPanel
          slug={cityId}
          conversionId={activeConversionId}
          onClose={() => setActiveConversionId(null)}
        />
      )}
    </div>
  );
}
