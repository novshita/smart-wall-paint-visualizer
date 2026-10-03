/** Maps image pixels to screen pixels: screen = image * scale + offset. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

/** Scale and centre the image inside the viewport, leaving some padding. */
export function fitView(imgW: number, imgH: number, viewW: number, viewH: number, pad = 24): View {
  const scale = Math.max(
    MIN_ZOOM,
    Math.min((viewW - pad * 2) / imgW, (viewH - pad * 2) / imgH, MAX_ZOOM),
  );
  return { scale, x: (viewW - imgW * scale) / 2, y: (viewH - imgH * scale) / 2 };
}

/** Zooms by `factor`, keeping the image point under (sx, sy) fixed on screen. */
export function zoomAt(view: View, factor: number, sx: number, sy: number): View {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor));
  const k = scale / view.scale;
  return { scale, x: sx - (sx - view.x) * k, y: sy - (sy - view.y) * k };
}

export function toImage(view: View, sx: number, sy: number): [number, number] {
  return [(sx - view.x) / view.scale, (sy - view.y) / view.scale];
}

export function toScreen(view: View, ix: number, iy: number): [number, number] {
  return [ix * view.scale + view.x, iy * view.scale + view.y];
}
