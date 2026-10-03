import { Point, Selection } from './editor.model';

export function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Rounds to 5 decimals (~0.02 px on a 2000 px image) to keep saved designs compact. */
export function roundPoint([x, y]: readonly number[]): Point {
  return [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5];
}

/** Drops points closer than `minDistance` to the last kept one (always keeps the last point). */
export function simplifyPath(points: Point[], minDistance: number): Point[] {
  if (points.length <= 2) return points.map(roundPoint);
  const kept: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (distance(points[i], kept[kept.length - 1]) >= minDistance) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  return kept.map(roundPoint);
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon([x, y]: readonly number[], polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Index of the vertex within `radius` of `p` (closest wins), or -1. */
export function nearestVertex(p: readonly number[], vertices: readonly number[][], radius: number) {
  let best = -1;
  let bestDist = radius;
  vertices.forEach((v, i) => {
    const d = distance(p, v);
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

export function hasArea(selection: Selection | undefined): boolean {
  if (!selection) return false;
  return (
    (selection.points?.length ?? 0) >= 3 || (selection.strokes ?? []).some((s) => s.mode === 'add')
  );
}

/** Keeps `type` consistent with content: 'mask' once brush strokes are involved. */
export function normaliseSelection(selection: Selection): Selection {
  const strokes = selection.strokes?.length ? selection.strokes : undefined;
  const points = selection.points && selection.points.length >= 3 ? selection.points : undefined;
  return { type: strokes ? 'mask' : 'polygon', points, strokes, feather: selection.feather ?? 0 };
}

export const EMPTY_SELECTION: Selection = { type: 'polygon', feather: 2 };
