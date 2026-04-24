import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  Entity,
  PolygonHierarchy,
} from 'cesium';

export interface BuildStockpilePreviewOpts {
  /** Outer-ring vertex positions in Cartesian3 (already projected onto the globe). */
  vertices: Cartesian3[];
  /** Metres a.s.l. where the prism's flat bottom sits. */
  baseHeight: number;
  /** Metres a.s.l. where the prism's flat top sits. Should be > baseHeight. */
  topHeight: number;
  /** Fill color — alpha is applied internally (0.9). */
  color: Color;
  /** Stable id so consumers can find/remove the entity later. */
  id: string;
}

/**
 * Build an extruded-polygon Entity that visualises a stockpile as a
 * flat-top prism between `baseHeight` and `topHeight`. Matches Phase 1
 * of the /measurements StockpileMeshPreview so users see the same
 * shape whether previewing a live draw or a saved inventory item.
 */
export function buildExtrudedStockpileEntity(
  opts: BuildStockpilePreviewOpts,
): Entity {
  const { vertices, baseHeight, topHeight, color, id } = opts;
  const safeTop = Math.max(topHeight, baseHeight + 0.01);
  return new Entity({
    id,
    polygon: {
      hierarchy: new PolygonHierarchy(vertices),
      height: baseHeight,
      extrudedHeight: safeTop,
      material: new ColorMaterialProperty(color.withAlpha(0.9)),
      outline: true,
      outlineColor: Color.WHITE.withAlpha(0.8),
    },
  });
}
