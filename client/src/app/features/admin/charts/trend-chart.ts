import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

export interface TrendSeries<T> {
  key: keyof T & string;
  label: string;
  /** Categorical slot colour (validated palette: blue, orange, aqua) */
  color: string;
}

const HEIGHT = 260;
const M = { top: 16, right: 96, bottom: 28, left: 40 };

/** Rounds the y-axis maximum up to a clean value and returns ~4 ticks. */
export function niceTicks(max: number, integers = true): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? pow * 10;
  // Counts can't be fractional, so never step by less than 1 (or by 2.5)
  const step = integers ? Math.max(1, Math.ceil(nice)) : nice;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * Multi-series line chart for daily counts: one shared axis, 2px lines, legend plus
 * end labels, and a crosshair tooltip that snaps to the nearest day (mouse, touch and
 * arrow keys). Values are also available in the table view next to it.
 */
@Component({
  selector: 'app-trend-chart',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trend-chart.html',
  styleUrl: './trend-chart.scss',
})
export class TrendChart<T extends { date: string }> {
  readonly points = input.required<T[]>();
  readonly series = input.required<TrendSeries<T>[]>();
  readonly label = input('Trend chart');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly width = signal(600);
  protected readonly height = HEIGHT;
  protected readonly m = M;
  protected readonly hover = signal<number | null>(null);

  protected readonly plotW = computed(() => Math.max(10, this.width() - M.left - M.right));
  protected readonly plotH = HEIGHT - M.top - M.bottom;

  protected readonly ticks = computed(() => {
    const max = Math.max(
      0,
      ...this.points().flatMap((p) => this.series().map((s) => Number(p[s.key]))),
    );
    return niceTicks(max);
  });
  private readonly yMax = computed(() => this.ticks().at(-1) || 1);

  protected x(i: number): number {
    const n = this.points().length;
    return M.left + (n <= 1 ? this.plotW() / 2 : (i / (n - 1)) * this.plotW());
  }

  protected y(v: number): number {
    return M.top + this.plotH - (v / this.yMax()) * this.plotH;
  }

  protected readonly paths = computed(() =>
    this.series().map((s) => ({
      ...s,
      d: this.points()
        .map(
          (p, i) =>
            `${i ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(Number(p[s.key])).toFixed(1)}`,
        )
        .join(''),
    })),
  );

  /** ~6 evenly spaced date labels */
  protected readonly xTicks = computed(() => {
    const n = this.points().length;
    if (!n) return [];
    const count = Math.min(n, this.width() < 480 ? 4 : 6);
    const idx = new Set(
      Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, count - 1))),
    );
    return [...idx].map((i) => ({ i, date: this.points()[i].date }));
  });

  /** End labels, unless they'd collide (then the legend and tooltip carry identity) */
  protected readonly endLabels = computed(() => {
    const last = this.points().at(-1);
    if (!last) return [];
    const labels = this.series().map((s) => ({
      ...s,
      value: Number(last[s.key]),
      y: this.y(Number(last[s.key])),
    }));
    const ys = labels.map((l) => l.y).sort((a, b) => a - b);
    const collide = ys.some((y, i) => i > 0 && y - ys[i - 1] < 14);
    return collide ? [] : labels;
  });

  protected readonly hoverPoint = computed(() => {
    const i = this.hover();
    return i === null ? null : this.points()[i];
  });

  protected readonly tooltipLeft = computed(() => {
    const i = this.hover();
    if (i === null) return 0;
    const x = this.x(i);
    return x > this.width() - 180 ? x - 172 : x + 12;
  });

  protected readonly summary = computed(() => {
    const totals = this.series().map(
      (s) => `${s.label}: ${this.points().reduce((sum, p) => sum + Number(p[s.key]), 0)}`,
    );
    return `${this.label()}. Totals: ${totals.join(', ')}. Use left and right arrow keys to read each day.`;
  });

  constructor() {
    afterNextRender(() => {
      const ro = new ResizeObserver(([entry]) =>
        this.width.set(Math.round(entry.contentRect.width)),
      );
      ro.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  protected value(p: T, key: keyof T): number {
    return Number(p[key]);
  }

  protected onPointer(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const x = event.clientX - svg.getBoundingClientRect().left;
    const n = this.points().length;
    if (!n) return;
    const t = n <= 1 ? 0 : (x - M.left) / this.plotW();
    this.hover.set(Math.min(n - 1, Math.max(0, Math.round(t * (n - 1)))));
  }

  protected onKey(event: KeyboardEvent): void {
    const n = this.points().length;
    if (!n) return;
    const current = this.hover() ?? n - 1;
    if (event.key === 'ArrowLeft') this.hover.set(Math.max(0, current - 1));
    else if (event.key === 'ArrowRight') this.hover.set(Math.min(n - 1, current + 1));
    else if (event.key === 'Escape') this.hover.set(null);
    else return;
    event.preventDefault();
  }
}
