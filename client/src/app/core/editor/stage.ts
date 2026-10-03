import { View, fitView, toImage, zoomAt } from './viewport';

type Ctx = CanvasRenderingContext2D;

export interface StageHandlers {
  /** Draw the frame. The context is reset to identity before each call. */
  draw(ctx: Ctx, view: View, dpr: number): void;
  /** Whether a primary-pointer drag should pan instead of using the current tool */
  wantsPan(e: PointerEvent): boolean;
  /** Tool interaction; return true to take over this pointer until it's released */
  pointerDown?(e: PointerEvent, at: [number, number]): boolean;
  pointerMove?(e: PointerEvent, at: [number, number]): void;
  pointerUp?(e: PointerEvent, at: [number, number]): void;
  /** A pan gesture that barely moved: treat it as a click */
  click?(e: PointerEvent, at: [number, number]): void;
  /** Pointer position for cursors/rubber bands (null when the pointer leaves) */
  hover?(at: [number, number] | null): void;
  /** A tool interaction was interrupted (e.g. a second finger started a pinch) */
  cancel?(): void;
}

interface Gesture {
  mode: 'none' | 'tool' | 'pan' | 'pinch';
  startView: View;
  startX: number;
  startY: number;
  moved: boolean;
  startDist: number;
}

/**
 * Canvas with zoom and pan (FR-W4): wheel/trackpad zoom at the cursor, drag to pan,
 * pinch-to-zoom and two-finger pan on touch screens (spec §13), crisp on HiDPI.
 */
export class Stage {
  private view: View = { scale: 1, x: 0, y: 0 };
  private readonly ctx: Ctx;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private gesture: Gesture = this.idle();
  private frame = 0;
  private fitted = false;
  private readonly resizeObserver: ResizeObserver;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly handlers: StageHandlers,
    private readonly imageSize: () => { width: number; height: number } | null,
    private readonly onViewChange: (view: View) => void = () => undefined,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not supported in this browser');
    this.ctx = ctx;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.resize();
  }

  get currentView(): View {
    return this.view;
  }

  setView(view: View): void {
    this.view = view;
    this.onViewChange(view);
    this.requestRender();
  }

  fit(): void {
    const size = this.imageSize();
    if (!size || !this.cssWidth) return;
    this.fitted = true;
    this.setView(fitView(size.width, size.height, this.cssWidth, this.cssHeight));
  }

  zoomBy(factor: number): void {
    this.setView(zoomAt(this.view, factor, this.cssWidth / 2, this.cssHeight / 2));
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const dpr = window.devicePixelRatio || 1;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.handlers.draw(this.ctx, this.view, dpr);
    });
  }

  /** Converts a pointer event to image coordinates (pixels of the working image). */
  imagePoint(e: { clientX: number; clientY: number }): [number, number] {
    const [x, y] = this.local(e);
    return toImage(this.view, x, y);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  // ---------- internals ----------

  private resize(): void {
    const host = this.canvas.parentElement ?? this.canvas;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (!this.fitted) this.fit();
    this.requestRender();
  }

  private local(e: { clientX: number; clientY: number }): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private idle(): Gesture {
    return { mode: 'none', startView: this.view, startX: 0, startY: 0, moved: false, startDist: 0 };
  }

  private pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    const [x, y] = this.local(e);
    this.pointers.set(e.pointerId, { x, y });
    this.canvas.setPointerCapture(e.pointerId);

    if (this.pointers.size === 2) {
      if (this.gesture.mode === 'tool') this.handlers.cancel?.();
      const { dist, mid } = this.pinchState();
      this.gesture = {
        mode: 'pinch',
        startView: this.view,
        startX: mid[0],
        startY: mid[1],
        moved: true,
        startDist: dist,
      };
      return;
    }
    if (this.pointers.size > 2) return;

    const at = toImage(this.view, x, y);
    const pan = e.button === 1 || this.handlers.wantsPan(e);
    if (!pan && this.handlers.pointerDown?.(e, at)) {
      this.gesture = { ...this.idle(), mode: 'tool' };
    } else if (pan) {
      this.gesture = {
        mode: 'pan',
        startView: this.view,
        startX: x,
        startY: y,
        moved: false,
        startDist: 0,
      };
    }
    e.preventDefault();
  };

  private readonly onMove = (e: PointerEvent) => {
    const [x, y] = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y });
    const at = toImage(this.view, x, y);
    const g = this.gesture;

    if (g.mode === 'pinch' && this.pointers.size >= 2) {
      const { dist, mid } = this.pinchState();
      const zoomed = zoomAt(g.startView, dist / g.startDist, g.startX, g.startY);
      this.setView({ ...zoomed, x: zoomed.x + mid[0] - g.startX, y: zoomed.y + mid[1] - g.startY });
    } else if (g.mode === 'pan') {
      const dx = x - g.startX;
      const dy = y - g.startY;
      if (Math.hypot(dx, dy) > 4) g.moved = true;
      this.setView({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy });
    } else if (g.mode === 'tool') {
      this.handlers.pointerMove?.(e, at);
    }
    this.handlers.hover?.(at);
  };

  private readonly onUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    const g = this.gesture;
    const at = this.imagePoint(e);
    if (g.mode === 'tool') {
      if (e.type === 'pointercancel') this.handlers.cancel?.();
      else this.handlers.pointerUp?.(e, at);
    } else if (g.mode === 'pan' && !g.moved && e.type !== 'pointercancel') {
      this.handlers.click?.(e, at);
    }
    // After a pinch, wait for every finger to lift before starting anything new
    if (this.pointers.size === 0 || g.mode !== 'pinch') this.gesture = this.idle();
  };

  private readonly onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !this.pointers.size) this.handlers.hover?.(null);
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const [x, y] = this.local(e);
    const step = e.deltaMode === 1 ? 0.05 : 0.0015; // lines vs pixels
    const factor = Math.exp(-e.deltaY * step * (e.ctrlKey ? 4 : 1)); // trackpad pinch sends ctrl+wheel
    this.setView(zoomAt(this.view, factor, x, y));
  };
}
