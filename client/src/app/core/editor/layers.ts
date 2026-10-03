import { Color, Finish } from '../../shared/models/catalog.model';
import { hexToRgb } from '../../shared/utils/color-utils';
import { Region, RegionStyle } from './editor.model';
import { hasArea } from './geometry';
import { PaintLayer } from './paint-engine';
import { PatternService } from './pattern.service';

export interface LayerContext {
  colors: ReadonlyMap<string, Color>;
  patterns: PatternService;
  defaultFinish: Finish;
  /** Size the layers are rendered at (pattern coverage depends on it) */
  width: number;
  height: number;
}

export function primaryHex(
  style: RegionStyle,
  colors: ReadonlyMap<string, Color>,
): string | undefined {
  return style.colorId ? colors.get(style.colorId)?.hex : style.customHex;
}

export function secondaryHex(
  style: RegionStyle,
  colors: ReadonlyMap<string, Color>,
): string | undefined {
  return style.secondaryColorId
    ? colors.get(style.secondaryColorId)?.hex
    : style.secondaryCustomHex;
}

/**
 * Turns a variant's walls into paint layers for the engine. Used for the live preview,
 * variant comparison, and full-resolution export, so all three always match.
 */
export function buildLayers(regions: readonly Region[], ctx: LayerContext): PaintLayer[] {
  const layers: PaintLayer[] = [];
  for (const r of regions) {
    if (!hasArea(r.selection)) continue;
    const s = r.style;
    const rgb = hexToRgb(primaryHex(s, ctx.colors));
    if (!rgb) continue;

    const layer: PaintLayer = {
      regionId: r.regionId,
      selection: r.selection,
      rgb,
      opacity: s.opacity ?? 100,
      brightness: s.brightness ?? 0,
      finish: s.finish ?? ctx.defaultFinish,
    };
    const second = hexToRgb(secondaryHex(s, ctx.colors));
    if (s.mode === 'dual' && second) {
      layer.secondaryRgb = second;
      layer.split = {
        direction: s.split?.direction ?? 'horizontal',
        position: s.split?.position ?? 50,
      };
    } else if (s.mode === 'pattern' && s.patternId) {
      const coverage = ctx.patterns.coverage(
        s.patternId,
        s.patternScale ?? 1,
        s.patternRotation ?? 0,
        ctx.width,
        ctx.height,
      );
      // Until the tile loads, show the background colour alone
      if (coverage) {
        layer.pattern = coverage;
        layer.secondaryRgb = second ?? [60, 60, 60];
      }
    }
    layers.push(layer);
  }
  return layers;
}

/** Short human description of a wall's paint, e.g. for the wall list and export captions. */
export function describeStyle(
  style: RegionStyle,
  colors: ReadonlyMap<string, Color>,
  patternName?: string,
): { hex: string; label: string; detail: string } | undefined {
  const hex = primaryHex(style, colors);
  if (!hex) return undefined;
  const name = (id?: string, custom?: string) => {
    const c = id ? colors.get(id) : undefined;
    return c
      ? { short: c.name, full: `${c.name} (${c.code}, ${c.brand})` }
      : { short: custom ?? '', full: `Custom ${custom}` };
  };
  const first = name(style.colorId, style.customHex);
  const second = name(style.secondaryColorId, style.secondaryCustomHex);
  const hasSecond = !!secondaryHex(style, colors);

  if (style.mode === 'dual' && hasSecond) {
    return {
      hex,
      label: `${first.short} / ${second.short}`,
      detail: `Two-tone: ${first.full} and ${second.full}`,
    };
  }
  if (style.mode === 'pattern' && style.patternId) {
    const pattern = patternName ?? 'Pattern';
    return {
      hex,
      label: `${pattern} · ${first.short}`,
      detail: `${pattern} pattern: ${hasSecond ? second.full : 'dark'} on ${first.full}`,
    };
  }
  const c = style.colorId ? colors.get(style.colorId) : undefined;
  return { hex, label: c ? `${c.name} · ${c.code}` : `Custom ${hex}`, detail: first.full };
}
