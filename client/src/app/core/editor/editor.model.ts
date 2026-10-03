import { Finish } from '../../shared/models/catalog.model';

/** [x, y] normalised to the image: 0 = left/top edge, 1 = right/bottom edge */
export type Point = [number, number];

/** A brush or eraser stroke. `size` is the brush diameter as a fraction of image width. */
export interface Stroke {
  mode: 'add' | 'erase';
  size: number;
  points: Point[];
}

/** A wall's selected area: an optional polygon refined by strokes, applied in order. */
export interface Selection {
  type: 'polygon' | 'mask';
  points?: Point[];
  strokes?: Stroke[];
  /** Soft-edge radius in working-image pixels (FR-W6) */
  feather: number;
}

export interface RegionStyle {
  mode?: 'solid' | 'dual' | 'pattern';
  colorId?: string;
  secondaryColorId?: string;
  customHex?: string;
  /** Second colour (dual-tone bottom/right, or pattern ink) when not from the library */
  secondaryCustomHex?: string;
  patternId?: string;
  split?: { direction?: 'horizontal' | 'vertical'; position?: number };
  opacity?: number;
  brightness?: number;
  finish?: Finish;
  patternScale?: number;
  patternRotation?: number;
}

export interface Region {
  regionId: string;
  name: string;
  selection: Selection;
  style: RegionStyle;
}

export type Tool = 'move' | 'polygon' | 'brush' | 'eraser';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
