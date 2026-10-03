import { httpResource } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Pattern, PatternPage } from '../../shared/models/catalog.model';
import { assetUrl } from '../../shared/utils/asset-url';
import { patternCoverage } from './pattern-field';

const CACHE_SIZE = 8;

/** Pattern catalogue and decoded tiles for the studio, with cached coverage maps. */
@Injectable()
export class PatternService {
  readonly list = httpResource<PatternPage>(() => `${environment.apiUrl}/patterns?limit=50`);
  readonly patterns = computed<Pattern[]>(() =>
    this.list.hasValue() ? this.list.value().items : [],
  );
  readonly byId = computed(() => new Map(this.patterns().map((p) => [p._id, p])));

  private readonly tiles = signal<ReadonlyMap<string, HTMLImageElement>>(new Map());
  private readonly loading = new Set<string>();
  private readonly coverageCache = new Map<string, Uint8Array>();

  /** The decoded tile, or undefined while it loads (callers re-run when it arrives). */
  tile(patternId: string): HTMLImageElement | undefined {
    const tile = this.tiles().get(patternId);
    if (!tile) this.load(patternId);
    return tile;
  }

  /** Pattern coverage for an image of w × h, or null until the tile has loaded. */
  coverage(
    patternId: string,
    scale: number,
    rotation: number,
    w: number,
    h: number,
  ): Uint8Array | null {
    const tile = this.tile(patternId);
    if (!tile) return null;
    const key = `${patternId}|${scale}|${rotation}|${w}x${h}`;
    let field = this.coverageCache.get(key);
    if (!field) {
      field = patternCoverage(tile, w, h, scale, rotation);
      this.coverageCache.set(key, field);
      if (this.coverageCache.size > CACHE_SIZE) {
        this.coverageCache.delete(this.coverageCache.keys().next().value!);
      }
    }
    return field;
  }

  private load(patternId: string): void {
    const pattern = this.byId().get(patternId);
    if (!pattern || this.loading.has(patternId)) return;
    this.loading.add(patternId);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = assetUrl(pattern.imageUrl);
    img
      .decode()
      .then(() => this.tiles.update((m) => new Map(m).set(patternId, img)))
      .catch(() => undefined)
      .finally(() => this.loading.delete(patternId));
  }
}
