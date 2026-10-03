import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../core/admin/admin.service';
import { Analytics, DailyPoint } from '../../shared/models/admin.model';
import { BarItem, BarList } from './charts/bar-list';
import { TrendChart, TrendSeries } from './charts/trend-chart';

const REFRESH_MS = 30_000;

/** KPI dashboard (spec §14, FR-AD7), refreshed every 30 s for near-real-time figures. */
@Component({
  selector: 'app-admin-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    BarList,
    TrendChart,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {
  protected readonly days = signal(30);
  protected readonly data = inject(AdminService).analytics(this.days);
  protected readonly showTable = signal(false);

  /** Keep showing the previous figures (dimmed) while the next refresh loads */
  protected readonly analytics = linkedSignal<Analytics | undefined, Analytics | undefined>({
    source: () => (this.data.hasValue() ? this.data.value() : undefined),
    computation: (next, prev) => next ?? prev?.value,
  });

  // Validated categorical slots 1–3 (blue, orange, aqua); see the data-viz palette check
  protected readonly series: TrendSeries<DailyPoint>[] = [
    { key: 'uploads', label: 'Uploads', color: '#2a78d6' },
    { key: 'saves', label: 'Saves', color: '#eb6834' },
    { key: 'downloads', label: 'Downloads', color: '#1baf7a' },
  ];

  protected readonly ratings = computed<BarItem[]>(() => {
    const dist = this.analytics()?.kpis.satisfaction.distribution ?? [];
    if (!dist.some((d) => d.count)) return []; // empty state instead of five zero-length bars
    return [...dist]
      .reverse()
      .map((d) => ({ label: `${d.rating} star${d.rating === 1 ? '' : 's'}`, value: d.count }));
  });

  protected readonly topColors = computed<BarItem[]>(() =>
    (this.analytics()?.topColors ?? []).map((t) => ({
      label: t.color.name,
      sublabel: `${t.color.code} · ${t.color.brand}`,
      value: t.uses,
      swatch: t.color.hex,
    })),
  );

  constructor() {
    const timer = setInterval(() => this.data.reload(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected duration(seconds: number): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
  }

  /** SVG points for a tiny sparkline of one series */
  protected spark(key: keyof DailyPoint): { line: string; last: [number, number] } | null {
    const pts = this.analytics()?.series ?? [];
    if (pts.length < 2) return null;
    const values = pts.map((p) => Number(p[key]));
    const max = Math.max(1, ...values);
    const coords = values.map(
      (v, i) => [(i / (values.length - 1)) * 100, 28 - (v / max) * 24] as [number, number],
    );
    return { line: coords.map((c) => c.join(',')).join(' '), last: coords[coords.length - 1] };
  }
}
