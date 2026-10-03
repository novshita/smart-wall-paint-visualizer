import {
  hasArea,
  nearestVertex,
  normaliseSelection,
  pointInPolygon,
  roundPoint,
  simplifyPath,
} from './geometry';
import { Point } from './editor.model';

describe('geometry', () => {
  const square: Point[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  it('tests points inside polygons', () => {
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
    expect(pointInPolygon([1.5, 0.5], square)).toBe(false);
  });

  it('simplifies dense paths but keeps both ends', () => {
    const dense: Point[] = Array.from({ length: 101 }, (_, i) => [i / 100, 0]);
    const simple = simplifyPath(dense, 0.1);
    expect(simple.length).toBeLessThan(15);
    expect(simple[0]).toEqual([0, 0]);
    expect(simple.at(-1)).toEqual([1, 0]);
  });

  it('rounds to 5 decimals', () => {
    expect(roundPoint([0.123456789, 0.987654321])).toEqual([0.12346, 0.98765]);
  });

  it('finds the nearest vertex within a radius', () => {
    expect(nearestVertex([0.98, 0.02], square, 0.05)).toBe(1);
    expect(nearestVertex([0.5, 0.5], square, 0.05)).toBe(-1);
  });

  it('knows whether a selection covers anything', () => {
    expect(hasArea({ type: 'polygon', feather: 0 })).toBe(false);
    expect(hasArea({ type: 'polygon', points: square, feather: 0 })).toBe(true);
    expect(
      hasArea({
        type: 'mask',
        strokes: [{ mode: 'erase', size: 0.1, points: [[0, 0]] }],
        feather: 0,
      }),
    ).toBe(false);
  });

  it('sets the selection type from its content', () => {
    expect(normaliseSelection({ type: 'mask', points: square, feather: 1 }).type).toBe('polygon');
    expect(
      normaliseSelection({
        type: 'polygon',
        strokes: [{ mode: 'add', size: 0.1, points: [[0, 0]] }],
        feather: 1,
      }).type,
    ).toBe('mask');
  });
});
