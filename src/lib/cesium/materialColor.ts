import { Color } from 'cesium';

export function materialColor(material: string | null | undefined): Color {
  switch ((material ?? '').toLowerCase()) {
    case 'iron_ore':
    case 'iron ore':
      return Color.fromCssColorString('#c2410c');
    case 'coal':
      return Color.fromCssColorString('#1f2937');
    case 'limestone':
      return Color.fromCssColorString('#e7e5e4');
    case 'copper':
    case 'copper_ore':
      return Color.fromCssColorString('#b45309');
    case 'gold':
    case 'gold_ore':
      return Color.fromCssColorString('#ca8a04');
    case 'bauxite':
      return Color.fromCssColorString('#9a3412');
    case 'sand':
      return Color.fromCssColorString('#d4a574');
    case 'gravel':
      return Color.fromCssColorString('#78716c');
    default:
      return Color.fromCssColorString('#eab308');
  }
}
