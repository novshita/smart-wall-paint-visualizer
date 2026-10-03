import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogService } from '../../core/catalog/catalog.service';
import { RecentColorsService } from '../../core/catalog/recent-colors.service';
import { ColorCache } from '../../core/editor/color-cache.service';
import { EditorStore } from '../../core/editor/editor.store';
import { hasArea } from '../../core/editor/geometry';
import { PaintLayer } from '../../core/editor/paint-engine';
import { SettingsService } from '../../core/settings/settings.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { WallList, WallPaint } from '../../shared/components/wall-list/wall-list';
import { Finish } from '../../shared/models/catalog.model';
import { hexToRgb } from '../../shared/utils/color-utils';
import { PaintPanel } from './paint-panel';
import { StudioCanvas } from './studio-canvas';

/** Step 2 of the editor: paint walls and compare before/after (spec §6.4, §8). */
@Component({
  selector: 'app-studio',
  imports: [
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatTooltipModule,
    Disclaimer,
    PaintPanel,
    StudioCanvas,
    WallList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './studio.html',
  styleUrl: './studio.scss',
  host: { '(document:keydown)': 'onKeyDown($event)' },
})
export class Studio {
  protected readonly store = inject(EditorStore);
  private readonly cache = inject(ColorCache);
  private readonly settings = inject(SettingsService).settings;
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly recent = inject(RecentColorsService);

  /** ?colorId= from "Try on my room": applied to the first unpainted wall */
  readonly colorId = input<string>();
  private readonly incoming = inject(CatalogService).color(this.colorId);

  protected readonly canvas = viewChild.required(StudioCanvas);
  protected readonly compare = signal(false);
  protected readonly comparePos = signal(0.5);
  protected readonly showBefore = signal(false);
  protected readonly saving = signal(false);

  protected readonly paintable = computed(() =>
    this.store.regions().filter((r) => hasArea(r.selection)),
  );
  protected readonly active = computed(() => {
    const a = this.store.activeRegion();
    return a && hasArea(a.selection) ? a : null;
  });
  protected readonly zoomPercent = computed(() => this.canvas().view().scale * 100);

  /** Each wall's paint as hex, from the library (colorId) or a custom HEX */
  private readonly hexByRegion = computed(() => {
    const colors = this.cache.byId();
    const map = new Map<string, string>();
    for (const r of this.store.regions()) {
      const hex = r.style.colorId ? colors.get(r.style.colorId)?.hex : r.style.customHex;
      if (hex) map.set(r.regionId, hex);
    }
    return map;
  });

  protected readonly layers = computed<PaintLayer[]>(() => {
    const hexes = this.hexByRegion();
    const defaultFinish = (this.settings().defaultFinish as Finish) ?? 'matte';
    return this.paintable().flatMap((r) => {
      const rgb = hexToRgb(hexes.get(r.regionId));
      if (!rgb) return [];
      return [
        {
          regionId: r.regionId,
          selection: r.selection,
          rgb,
          opacity: r.style.opacity ?? 100,
          brightness: r.style.brightness ?? 0,
          finish: r.style.finish ?? defaultFinish,
        },
      ];
    });
  });

  protected readonly wallPaint = computed(() => {
    const colors = this.cache.byId();
    const result: Record<string, WallPaint | undefined> = {};
    for (const r of this.store.regions()) {
      const color = r.style.colorId ? colors.get(r.style.colorId) : undefined;
      const hex = color?.hex ?? r.style.customHex;
      if (hex)
        result[r.regionId] = {
          hex,
          label: color ? `${color.name} · ${color.code}` : `Custom ${hex}`,
        };
    }
    return result;
  });

  constructor() {
    // Fetch details of library colours already used on any wall (any variant)
    effect(() => {
      const ids = this.store
        .variants()
        .flatMap((v) => v.regions.map((r) => r.style.colorId))
        .filter((id): id is string => !!id);
      untracked(() => this.cache.ensure(ids));
    });

    // Make sure a paintable wall is selected
    effect(() => {
      const walls = this.paintable();
      const activeId = this.store.activeRegionId();
      if (walls.length && !walls.some((w) => w.regionId === activeId)) {
        untracked(() => this.store.activeRegionId.set(walls[0].regionId));
      }
    });

    // "Try on my room": paint the first unpainted wall with the chosen colour, once
    effect(() => {
      if (!this.incoming.hasValue()) return;
      const color = this.incoming.value().color;
      untracked(() => {
        const walls = this.paintable();
        const target =
          walls.find(
            (w) => w.regionId === this.store.activeRegionId() && !this.isPainted(w.style),
          ) ?? walls.find((w) => !this.isPainted(w.style));
        if (target) {
          this.cache.remember(color);
          this.recent.add(color);
          this.store.activeRegionId.set(target.regionId);
          this.store.setStyle(target.regionId, {
            mode: 'solid',
            colorId: color._id,
            opacity: 100,
            brightness: 0,
            finish: (this.settings().defaultFinish as Finish) ?? 'matte',
          });
        }
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { colorId: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  protected async saveDesign(): Promise<void> {
    this.saving.set(true);
    try {
      await this.store.save('saved');
      this.snackBar.open('Design saved', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open(`Couldn't save: ${this.store.saveError() ?? 'please try again'}`, 'OK', {
        duration: 5000,
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], mat-slider')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      this.store.redo();
    } else if (mod && key === 's') {
      e.preventDefault();
      void this.saveDesign();
    } else if (!mod && !e.altKey) {
      if (key === '+' || key === '=') this.canvas().zoomBy(1.25);
      else if (key === '-') this.canvas().zoomBy(0.8);
      else if (key === '0') this.canvas().fit();
      else if (key === '\\') this.compare.update((c) => !c);
    }
  }

  private isPainted(style: { colorId?: string; customHex?: string }): boolean {
    return !!(style.colorId || style.customHex);
  }
}
