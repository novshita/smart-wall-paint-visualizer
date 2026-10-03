import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error.model';
import { Project, Variant } from '../../shared/models/project.model';
import { Region, RegionStyle, SaveState, Selection } from './editor.model';
import { EMPTY_SELECTION, normaliseSelection } from './geometry';
import { History } from './history';

interface Snapshot {
  variants: Variant[];
  activeRegionId: string | null;
}

const AUTOSAVE_DELAY_MS = 1200;
export const MAX_VARIANTS = 10;

/** Distinct overlay colours for walls on the selection screen */
export const WALL_COLORS = ['#1f8fff', '#ff6b3d', '#2ec27e', '#c061cb', '#f5c211', '#00b8d4'];

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * State for one project while it's open in the editor (wall selection + studio).
 * Provided by the editor shell so both screens share it.
 *
 * - Walls (selections) are shared by all variants; styles belong to each variant.
 * - Every user-visible change can be undone (FR-W4); slider drags are grouped into one step.
 * - Changes are auto-saved shortly after the user stops editing (FR-S2).
 */
@Injectable()
export class EditorStore {
  private readonly http = inject(HttpClient);

  readonly project = signal<Project | null>(null);
  /** The decoded working image, shared by the selection and studio canvases */
  readonly image = signal<HTMLImageElement | null>(null);
  readonly variants = signal<Variant[]>([]);
  readonly activeVariantId = signal<string | null>(null);
  readonly activeRegionId = signal<string | null>(null);
  readonly saveState = signal<SaveState>('saved');
  readonly saveError = signal<string | null>(null);

  readonly variant = computed<Variant | undefined>(
    () =>
      this.variants().find((v) => v.variantId === this.activeVariantId()) ?? this.variants().at(0),
  );
  readonly regions = computed<Region[]>(() => this.variant()?.regions ?? []);
  readonly activeRegion = computed(
    () => this.regions().find((r) => r.regionId === this.activeRegionId()) ?? null,
  );

  private readonly history = new History<Snapshot>(100);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  /** Bumped on every change; saving compares versions to know if more edits arrived */
  private readonly version = signal(0);
  private savedVersion = 0;
  private gestureStart: Snapshot | null = null;
  private saving: Promise<void> | null = null;

  constructor() {
    effect((onCleanup) => {
      const v = this.version();
      if (v === this.savedVersion) return;
      const timer = setTimeout(() => untracked(() => void this.save()), AUTOSAVE_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });

    const warnIfUnsaved = (e: BeforeUnloadEvent) => {
      if (this.isDirty()) e.preventDefault();
    };
    window.addEventListener('beforeunload', warnIfUnsaved);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', warnIfUnsaved));
  }

  load(project: Project): void {
    this.project.set(project);
    this.variants.set(project.variants);
    this.activeVariantId.set(project.variants[0]?.variantId ?? null);
    this.activeRegionId.set(project.variants[0]?.regions[0]?.regionId ?? null);
    this.history.clear();
    this.syncHistoryFlags();
    this.version.set(0);
    this.savedVersion = 0;
    this.saveState.set('saved');
  }

  isDirty(): boolean {
    return this.version() !== this.savedVersion;
  }

  /** Renames the project (saved straight away; not an undo step). */
  async renameProject(title: string): Promise<void> {
    const project = this.project();
    const trimmed = title.trim().slice(0, 150);
    if (!project || !trimmed || trimmed === project.title) return;
    this.project.set({ ...project, title: trimmed });
    try {
      await firstValueFrom(this.put(project._id, { title: trimmed }));
    } catch (err) {
      this.project.set(project);
      throw err;
    }
  }

  // ---------- walls (shared across variants) ----------

  addWall(): string {
    const regionId = newId('wall');
    const name = this.nextWallName();
    this.commit((variants) =>
      variants.map((v) => ({
        ...v,
        regions: [...v.regions, { regionId, name, selection: EMPTY_SELECTION, style: {} }],
      })),
    );
    this.activeRegionId.set(regionId);
    return regionId;
  }

  renameWall(regionId: string, name: string): void {
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) return;
    this.commit((variants) =>
      this.mapRegion(variants, regionId, (r) => ({ ...r, name: trimmed }), true),
    );
  }

  deleteWall(regionId: string): void {
    const ids = this.regions().map((r) => r.regionId);
    const index = ids.indexOf(regionId);
    this.commit((variants) =>
      variants.map((v) => ({ ...v, regions: v.regions.filter((r) => r.regionId !== regionId) })),
    );
    if (this.activeRegionId() === regionId) {
      const remaining = ids.filter((id) => id !== regionId);
      this.activeRegionId.set(remaining[Math.min(index, remaining.length - 1)] ?? null);
    }
  }

  /** Replaces a wall's selection in every variant. */
  setSelection(regionId: string, selection: Selection, { history = true } = {}): void {
    const normalised = normaliseSelection(selection);
    const apply = (variants: Variant[]) =>
      this.mapRegion(variants, regionId, (r) => ({ ...r, selection: normalised }), true);
    if (history) this.commit(apply);
    else this.preview(apply);
  }

  // ---------- design variants (FR-C6) ----------

  /** Switching variants is navigation, not an edit: no undo step, nothing to save. */
  selectVariant(variantId: string): void {
    if (this.variants().some((v) => v.variantId === variantId)) this.activeVariantId.set(variantId);
  }

  /** Adds a variant copying the current one's colours (walls are always shared). */
  addVariant(): string | null {
    if (this.variants().length >= MAX_VARIANTS) return null;
    const source = this.variant();
    const variantId = newId('v');
    const names = new Set(this.variants().map((v) => v.name));
    let n = this.variants().length + 1;
    while (names.has(`Design ${n}`)) n++;
    const copy: Variant = {
      variantId,
      name: `Design ${n}`,
      regions: (source?.regions ?? []).map((r) => ({ ...r, style: { ...r.style } })),
    };
    this.commit((variants) => [...variants, copy]);
    this.activeVariantId.set(variantId);
    return variantId;
  }

  renameVariant(variantId: string, name: string): void {
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) return;
    this.commit((variants) =>
      variants.map((v) => (v.variantId === variantId ? { ...v, name: trimmed } : v)),
    );
  }

  deleteVariant(variantId: string): void {
    const list = this.variants();
    if (list.length <= 1) return;
    const index = list.findIndex((v) => v.variantId === variantId);
    this.commit((variants) => variants.filter((v) => v.variantId !== variantId));
    if (this.activeVariantId() === variantId) {
      const remaining = this.variants();
      this.activeVariantId.set(remaining[Math.min(index, remaining.length - 1)].variantId);
    }
  }

  /** Records the latest rendered preview URL for a variant (from POST /render). */
  setRenderUrl(variantId: string, renderUrl: string | undefined): void {
    this.variants.update((variants) =>
      variants.map((v) => (v.variantId === variantId ? { ...v, renderUrl } : v)),
    );
  }

  // ---------- styles (active variant only) ----------

  setStyle(regionId: string, patch: Partial<RegionStyle>, { history = true } = {}): void {
    const apply = (variants: Variant[]) =>
      this.mapRegion(variants, regionId, (r) => ({ ...r, style: { ...r.style, ...patch } }), false);
    if (history) this.commit(apply);
    else this.preview(apply);
  }

  clearStyle(regionId: string): void {
    this.commit((variants) =>
      this.mapRegion(variants, regionId, (r) => ({ ...r, style: {} }), false),
    );
  }

  // ---------- undo / redo ----------

  /** Starts a continuous change (slider or vertex drag) that becomes one undo step. */
  beginGesture(): void {
    this.gestureStart ??= this.snapshot();
  }

  endGesture(): void {
    const start = this.gestureStart;
    this.gestureStart = null;
    if (start && start.variants !== this.variants()) {
      this.history.push(start);
      this.syncHistoryFlags();
    }
  }

  undo(): void {
    const previous = this.history.undo(this.snapshot());
    if (previous) this.restore(previous);
  }

  redo(): void {
    const next = this.history.redo(this.snapshot());
    if (next) this.restore(next);
  }

  // ---------- saving ----------

  /** Saves now. Concurrent calls share one request; edits made meanwhile trigger another. */
  async save(status?: 'saved'): Promise<void> {
    if (this.saving) {
      await this.saving;
      if (!this.isDirty() && !status) return;
    }
    const project = this.project();
    if (!project) return;

    const version = this.version();
    this.saveState.set('saving');
    this.saving = (async () => {
      try {
        const body: Record<string, unknown> = { variants: this.variants() };
        if (status) body['status'] = status;
        const res = await firstValueFrom(this.put(project._id, body));
        this.savedVersion = version;
        this.project.update((p) =>
          p ? { ...p, status: res.project.status, updatedAt: res.project.updatedAt } : p,
        );
        this.saveError.set(null);
        this.saveState.set(this.isDirty() ? 'unsaved' : 'saved');
      } catch (err) {
        this.saveError.set((err as ApiError).message ?? 'Save failed');
        this.saveState.set('error');
        throw err;
      } finally {
        this.saving = null;
      }
    })();
    await this.saving;
  }

  /** Saves pending changes, e.g. before leaving the editor. Resolves false if saving failed. */
  async flush(): Promise<boolean> {
    if (!this.isDirty() && !this.saving) return true;
    try {
      await this.save();
      return true;
    } catch {
      return false;
    }
  }

  // ---------- internals ----------

  private put(id: string, body: Record<string, unknown>): Observable<{ project: Project }> {
    return this.http.put<{ project: Project }>(`${environment.apiUrl}/projects/${id}`, body);
  }

  private commit(update: (variants: Variant[]) => Variant[]): void {
    const before = this.snapshot();
    this.variants.set(update(this.variants()));
    if (!this.gestureStart) {
      this.history.push(before);
      this.syncHistoryFlags();
    }
    this.markDirty();
  }

  private preview(update: (variants: Variant[]) => Variant[]): void {
    this.beginGesture();
    this.variants.set(update(this.variants()));
    this.markDirty();
  }

  private mapRegion(
    variants: Variant[],
    regionId: string,
    fn: (r: Region) => Region,
    allVariants: boolean,
  ): Variant[] {
    const activeId = this.variant()?.variantId;
    return variants.map((v) =>
      allVariants || v.variantId === activeId
        ? { ...v, regions: v.regions.map((r) => (r.regionId === regionId ? fn(r) : r)) }
        : v,
    );
  }

  private nextWallName(): string {
    const names = new Set(this.regions().map((r) => r.name));
    let n = this.regions().length + 1;
    while (names.has(`Wall ${n}`)) n++;
    return `Wall ${n}`;
  }

  private snapshot(): Snapshot {
    return { variants: this.variants(), activeRegionId: this.activeRegionId() };
  }

  private restore(s: Snapshot): void {
    this.variants.set(s.variants);
    const ids = s.variants[0]?.regions.map((r) => r.regionId) ?? [];
    this.activeRegionId.set(
      s.activeRegionId && ids.includes(s.activeRegionId) ? s.activeRegionId : (ids[0] ?? null),
    );
    this.syncHistoryFlags();
    this.markDirty();
  }

  private markDirty(): void {
    this.version.update((v) => v + 1);
    if (this.saveState() !== 'saving') this.saveState.set('unsaved');
  }

  private syncHistoryFlags(): void {
    this.canUndo.set(this.history.canUndo);
    this.canRedo.set(this.history.canRedo);
  }
}
