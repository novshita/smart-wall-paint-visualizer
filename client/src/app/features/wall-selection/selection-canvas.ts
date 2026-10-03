import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { EditorStore, WALL_COLORS } from '../../core/editor/editor.store';
import { Point, Region, Tool } from '../../core/editor/editor.model';
import {
  distance,
  hasArea,
  nearestVertex,
  roundPoint,
  simplifyPath,
} from '../../core/editor/geometry';
import { AnyCanvas, context2d, createCanvas, drawSelection } from '../../core/editor/mask';
import { Stage } from '../../core/editor/stage';
import { View, toScreen } from '../../core/editor/viewport';

interface LiveStroke {
  regionId: string;
  mode: 'add' | 'erase';
  sizePx: number;
  points: Point[];
  last: [number, number];
}

interface Overlay {
  selection: Region['selection'];
  color: string;
  canvas: AnyCanvas;
}

/**
 * Interactive canvas for selecting walls (FR-W1–W4): polygon tracing with draggable
 * vertices, brush/eraser painting, click-to-select, zoom and pan.
 */
@Component({
  selector: 'app-selection-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas
    #canvas
    [style.cursor]="cursor()"
    role="img"
    [attr.aria-label]="'Room photo. ' + store.regions().length + ' walls selected.'"
  ></canvas>`,
  host: {
    // Focusable so keyboard shortcuts (Enter, Esc…) go to the canvas, not the last clicked button
    tabindex: '0',
    '(pointerdown)': 'focusSelf()',
  },
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #ebe8e2;
      touch-action: none;
      user-select: none;
    }
    :host(:focus-visible) {
      outline: 3px solid var(--swpv-accent);
      outline-offset: -3px;
    }
    canvas {
      position: absolute;
      inset: 0;
      display: block;
    }
  `,
})
export class SelectionCanvas {
  protected readonly store = inject(EditorStore);

  readonly tool = input.required<Tool>();
  /** Brush diameter in working-image pixels */
  readonly brushSize = input(40);
  /** Temporarily pan with any tool (space bar held) */
  readonly panMode = input(false);

  readonly view = signal<View>({ scale: 1, x: 0, y: 0 });
  /** An unfinished polygon, tied to the wall it was started on */
  private readonly draft = signal<{ regionId: string; points: Point[] } | null>(null);
  /** True while a polygon is being traced on the selected wall but not yet closed */
  readonly drafting = computed(() => this.draft()?.regionId === this.store.activeRegionId());
  readonly hint = signal<string | null>(null);

  protected readonly cursor = computed(() => {
    if (this.panMode() || this.tool() === 'move') return 'grab';
    return this.tool() === 'polygon' ? 'crosshair' : 'none';
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private stage?: Stage;
  private hoverAt: [number, number] | null = null;
  private dragVertex = -1;
  private live: LiveStroke | null = null;
  private readonly overlays = new Map<string, Overlay>();

  constructor() {
    afterNextRender(() => {
      this.stage = new Stage(
        this.canvasRef().nativeElement,
        {
          draw: (ctx, view, dpr) => this.draw(ctx, view, dpr),
          wantsPan: (e) => this.panMode() || this.tool() === 'move' || e.button === 1,
          pointerDown: (e, at) => this.onPointerDown(e, at),
          pointerMove: (_e, at) => this.onPointerMove(at),
          pointerUp: () => this.onPointerUp(),
          click: (_e, at) => this.selectWallAt(at),
          hover: (at) => {
            this.hoverAt = at;
            if (this.drafting() || this.tool() === 'brush' || this.tool() === 'eraser')
              this.render();
          },
          cancel: () => this.onCancel(),
        },
        () => this.imageSize(),
        (view) => this.view.set(view),
      );
    });

    // Redraw whenever anything visible changes
    effect(() => {
      this.store.regions();
      this.store.activeRegionId();
      this.store.image();
      this.tool();
      this.brushSize();
      this.render();
    });

    inject(DestroyRef).onDestroy(() => this.stage?.destroy());
  }

  // ---------- public API for the page (toolbar, keyboard shortcuts) ----------

  protected focusSelf(): void {
    this.host.nativeElement.focus({ preventScroll: true });
  }

  zoomBy(factor: number): void {
    this.stage?.zoomBy(factor);
  }

  fit(): void {
    this.stage?.fit();
  }

  closeDraft(): void {
    const points = this.activeDraft();
    const region = this.store.activeRegion();
    if (points && region && points.length >= 3) {
      this.store.setSelection(region.regionId, {
        ...region.selection,
        points: points.map(roundPoint),
      });
    }
    this.cancelDraft();
  }

  /** Abandons an unfinished polygon (also called by the page when the tool changes). */
  cancelDraft(): void {
    if (!this.draft()) return;
    this.draft.set(null);
    this.render();
  }

  /** Removes the last placed polygon point; returns false if there was nothing to remove. */
  undoDraftPoint(): boolean {
    const points = this.activeDraft();
    if (!points) return false;
    if (points.length <= 1) this.cancelDraft();
    else this.draft.update((d) => d && { ...d, points: points.slice(0, -1) });
    this.render();
    return true;
  }

  /** Points of the unfinished polygon, if it belongs to the selected wall. */
  private activeDraft(): Point[] | null {
    const d = this.draft();
    return d && d.regionId === this.store.activeRegionId() ? d.points : null;
  }

  // ---------- pointer handling ----------

  private onPointerDown(e: PointerEvent, at: [number, number]): boolean {
    this.hint.set(null);
    const tool = this.tool();
    if (tool === 'polygon') return this.polygonDown(e, at);
    if (tool === 'brush' || tool === 'eraser')
      return this.brushDown(at, tool === 'brush' ? 'add' : 'erase');
    return false;
  }

  private onPointerMove(at: [number, number]): void {
    if (this.dragVertex >= 0) this.moveVertex(at);
    else if (this.live) this.brushMove(at);
  }

  private onPointerUp(): void {
    if (this.dragVertex >= 0) {
      this.dragVertex = -1;
      this.store.endGesture();
    } else if (this.live) {
      this.commitStroke();
    }
  }

  private onCancel(): void {
    if (this.live) {
      this.overlays.delete(this.live.regionId); // discard the half-drawn stroke
      this.live = null;
    }
    if (this.dragVertex >= 0) {
      this.dragVertex = -1;
      this.store.endGesture();
    }
    this.render();
  }

  private polygonDown(e: PointerEvent, at: [number, number]): boolean {
    const size = this.imageSize();
    if (!size) return false;
    const radius = (e.pointerType === 'touch' ? 22 : 10) / this.view().scale;
    let region = this.store.activeRegion();
    const polygon = region?.selection.points;
    const draft = this.activeDraft();

    if (region && polygon && polygon.length >= 3 && !draft) {
      const vertices = polygon.map((p) => [p[0] * size.width, p[1] * size.height]);
      const index = nearestVertex(at, vertices, radius);
      if (index >= 0) {
        this.store.beginGesture();
        this.dragVertex = index;
        return true;
      }
      this.hint.set(
        'This wall already has a shape. Drag its corner points to adjust it, use the brush to add to it, or add a new wall.',
      );
      return false;
    }

    if (!region) {
      this.store.addWall();
      region = this.store.activeRegion()!;
    }
    const p = this.normalise(at);
    if (!draft) {
      this.draft.set({ regionId: region.regionId, points: [p] });
    } else {
      const first = [draft[0][0] * size.width, draft[0][1] * size.height];
      if (draft.length >= 3 && distance(at, first) <= radius) {
        this.closeDraft();
        return true;
      }
      this.draft.set({ regionId: region.regionId, points: [...draft, p] });
    }
    this.render();
    return true;
  }

  private moveVertex(at: [number, number]): void {
    const region = this.store.activeRegion();
    const points = region?.selection.points;
    if (!region || !points) return;
    const next = points.map((p, i) => (i === this.dragVertex ? roundPoint(this.normalise(at)) : p));
    this.store.setSelection(
      region.regionId,
      { ...region.selection, points: next },
      { history: false },
    );
  }

  private brushDown(at: [number, number], mode: 'add' | 'erase'): boolean {
    if (!this.store.activeRegion()) this.store.addWall();
    const region = this.store.activeRegion();
    if (!region) return false;

    this.live = {
      regionId: region.regionId,
      mode,
      sizePx: this.brushSize(),
      points: [this.normalise(at)],
      last: at,
    };
    this.paintLive(at, at);
    return true;
  }

  private brushMove(at: [number, number]): void {
    const live = this.live!;
    if (distance(at, live.last) < Math.max(1, live.sizePx * 0.08)) return;
    this.paintLive(live.last, at);
    live.points.push(this.normalise(at));
    live.last = at;
  }

  private commitStroke(): void {
    const live = this.live!;
    this.live = null;
    const size = this.imageSize();
    const region = this.store.regions().find((r) => r.regionId === live.regionId);
    if (!size || !region) return;

    const strokeSize = live.sizePx / size.width;
    const stroke = {
      mode: live.mode,
      size: strokeSize,
      points: simplifyPath(live.points, strokeSize * 0.1),
    };
    this.store.setSelection(region.regionId, {
      ...region.selection,
      strokes: [...(region.selection.strokes ?? []), stroke],
    });

    // The overlay already shows this stroke; keep it instead of re-rasterising
    const overlay = this.overlays.get(region.regionId);
    const saved = this.store.regions().find((r) => r.regionId === region.regionId);
    if (overlay && saved) overlay.selection = saved.selection;
    this.render();
  }

  /** Draws the stroke segment straight onto the wall's overlay for instant feedback. */
  private paintLive(from: [number, number], to: [number, number]): void {
    const live = this.live!;
    const index = this.store.regions().findIndex((r) => r.regionId === live.regionId);
    const region = this.store.regions()[index];
    const overlay = this.overlayFor(region, this.colorFor(index));
    const ctx = context2d(overlay.canvas);
    ctx.save();
    ctx.globalCompositeOperation = live.mode === 'add' ? 'source-over' : 'destination-out';
    ctx.fillStyle = ctx.strokeStyle = overlay.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = live.sizePx;
    ctx.beginPath();
    if (from === to) {
      ctx.arc(to[0], to[1], live.sizePx / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
    }
    ctx.restore();
    this.render();
  }

  private selectWallAt(at: [number, number]): void {
    const size = this.imageSize();
    if (!size) return;
    const [x, y] = [Math.floor(at[0]), Math.floor(at[1])];
    if (x < 0 || y < 0 || x >= size.width || y >= size.height) return;
    const regions = this.store.regions();
    for (let i = regions.length - 1; i >= 0; i--) {
      if (!hasArea(regions[i].selection)) continue;
      const ctx = context2d(this.overlayFor(regions[i], this.colorFor(i)).canvas);
      if (ctx.getImageData(x, y, 1, 1).data[3] > 0) {
        this.store.activeRegionId.set(regions[i].regionId);
        return;
      }
    }
  }

  // ---------- drawing ----------

  private render(): void {
    this.stage?.requestRender();
  }

  private draw(ctx: CanvasRenderingContext2D, view: View, dpr: number): void {
    const img = this.store.image();
    const size = this.imageSize();
    if (!img || !size) return;

    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.x, dpr * view.y);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, size.width, size.height);

    const regions = this.store.regions();
    const activeId = this.store.activeRegionId();
    regions.forEach((region, i) => {
      const isLive = this.live?.regionId === region.regionId;
      if (!hasArea(region.selection) && !isLive) return;
      ctx.globalAlpha = region.regionId === activeId ? 0.5 : 0.28;
      ctx.drawImage(this.overlayFor(region, this.colorFor(i)).canvas as CanvasImageSource, 0, 0);
    });
    ctx.globalAlpha = 1;
    this.pruneOverlays(regions);

    // Outlines and handles in screen space so they stay the same size at any zoom
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const active = this.store.activeRegion();
    const activeIndex = regions.findIndex((r) => r.regionId === activeId);
    const color = this.colorFor(activeIndex);
    const toPx = (p: Point) => toScreen(view, p[0] * size.width, p[1] * size.height);

    const polygon = active?.selection.points;
    const draft = this.activeDraft();
    if (polygon && polygon.length >= 3 && !draft) {
      this.pathOutline(ctx, polygon.map(toPx), true, color);
      if (this.tool() === 'polygon') polygon.map(toPx).forEach((p) => this.handle(ctx, p, color));
    }

    if (draft) {
      const pts = draft.map(toPx);
      const hover = this.hoverAt ? toScreen(view, this.hoverAt[0], this.hoverAt[1]) : null;
      this.pathOutline(ctx, hover ? [...pts, hover] : pts, false, color);
      pts.forEach((p, i) => this.handle(ctx, p, color, i === 0 && pts.length >= 3));
    }

    const tool = this.tool();
    if ((tool === 'brush' || tool === 'eraser') && this.hoverAt && !this.panMode()) {
      const [cx, cy] = toScreen(view, this.hoverAt[0], this.hoverAt[1]);
      const r = Math.max(2, (this.brushSize() * view.scale) / 2);
      ctx.lineWidth = 1.5;
      ctx.setLineDash(tool === 'eraser' ? [4, 3] : []);
      for (const [stroke, w] of [
        ['rgba(0,0,0,0.6)', 3],
        ['#fff', 1.5],
      ] as const) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  private pathOutline(
    ctx: CanvasRenderingContext2D,
    pts: number[][],
    closed: boolean,
    color: string,
  ) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private handle(
    ctx: CanvasRenderingContext2D,
    [x, y]: number[],
    color: string,
    emphasise = false,
  ) {
    ctx.beginPath();
    ctx.arc(x, y, emphasise ? 8 : 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  // ---------- helpers ----------

  private imageSize(): { width: number; height: number } | null {
    const img = this.store.image();
    return img ? { width: img.naturalWidth, height: img.naturalHeight } : null;
  }

  private normalise([x, y]: [number, number]): Point {
    const size = this.imageSize()!;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return [clamp(x / size.width), clamp(y / size.height)];
  }

  private colorFor(index: number): string {
    return WALL_COLORS[Math.max(0, index) % WALL_COLORS.length];
  }

  private overlayFor(region: Region, color: string): Overlay {
    const cached = this.overlays.get(region.regionId);
    if (cached && cached.selection === region.selection && cached.color === color) return cached;
    const { width, height } = this.imageSize()!;
    const canvas = cached?.canvas ?? createCanvas(width, height);
    drawSelection(context2d(canvas), region.selection, width, height, color);
    const overlay = { selection: region.selection, color, canvas };
    this.overlays.set(region.regionId, overlay);
    return overlay;
  }

  private pruneOverlays(regions: Region[]): void {
    const ids = new Set(regions.map((r) => r.regionId));
    for (const id of this.overlays.keys()) if (!ids.has(id)) this.overlays.delete(id);
  }
}
