import { NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogService } from '../../core/catalog/catalog.service';
import { FavoritesService } from '../../core/catalog/favorites.service';
import { RecentColorsService } from '../../core/catalog/recent-colors.service';
import { ColorCache } from '../../core/editor/color-cache.service';
import { EditorStore } from '../../core/editor/editor.store';
import { Region, RegionStyle } from '../../core/editor/editor.model';
import { primaryHex, secondaryHex } from '../../core/editor/layers';
import { PatternService } from '../../core/editor/pattern.service';
import { SettingsService } from '../../core/settings/settings.service';
import { Color, Finish, Pattern } from '../../shared/models/catalog.model';
import { assetUrl } from '../../shared/utils/asset-url';
import { readableTextColor, shadeHex } from '../../shared/utils/color-utils';

const HEX = /^#[0-9a-f]{6}$/i;
type Mode = 'solid' | 'dual' | 'pattern';
type Slot = 'primary' | 'secondary';

/**
 * Paint controls for the selected wall: solid colour, two-tone split (FR-C2) or
 * pattern (FR-C3), colours from library/favourites/recent/custom (FR-C1, FR-L6),
 * finish/opacity/brightness (FR-C4) and colour name/code/brand display (FR-C8).
 */
@Component({
  selector: 'app-paint-panel',
  imports: [
    NgTemplateOutlet,
    TitleCasePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSliderModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paint-panel.html',
  styleUrl: './paint-panel.scss',
})
export class PaintPanel {
  private readonly store = inject(EditorStore);
  private readonly cache = inject(ColorCache);
  private readonly recent = inject(RecentColorsService);
  protected readonly favorites = inject(FavoritesService);
  protected readonly patterns = inject(PatternService);
  private readonly settings = inject(SettingsService).settings;

  readonly region = input.required<Region>();

  protected readonly finishes: Finish[] = ['matte', 'satin', 'glossy'];
  protected readonly modes: { id: Mode; label: string; icon: string }[] = [
    { id: 'solid', label: 'Solid', icon: 'format_color_fill' },
    { id: 'dual', label: 'Two-tone', icon: 'splitscreen' },
    { id: 'pattern', label: 'Pattern', icon: 'texture' },
  ];
  protected readonly recentColors = this.recent.colors;
  protected readonly assetUrl = assetUrl;

  // ---- library browser ----
  protected readonly search = signal('');
  private readonly debouncedSearch = signal('');
  protected readonly family = signal<string | null>(null);
  protected readonly facets = inject(CatalogService).colorFacets();
  protected readonly library = inject(CatalogService).colors(() => ({
    q: this.debouncedSearch() || undefined,
    family: this.family() ?? undefined,
    limit: 100,
  }));

  // ---- current paint ----
  protected readonly style = computed<RegionStyle>(() => this.region().style ?? {});
  protected readonly mode = computed<Mode>(() => this.style().mode ?? 'solid');
  /**
   * Which colour the pickers change. Solid paint has only the main colour; switching a wall
   * to two-tone or pattern starts on the new second colour; changing walls resets it.
   */
  protected readonly slot = linkedSignal<{ id: string; mode: Mode }, Slot>({
    source: () => ({ id: this.region().regionId, mode: this.mode() }),
    computation: (src, prev) => {
      if (src.mode === 'solid' || !prev || prev.source.id !== src.id) return 'primary';
      return prev.source.mode === 'solid' ? 'secondary' : prev.value;
    },
  });

  protected readonly primary = computed(() => this.slotInfo('primary'));
  protected readonly secondary = computed(() => this.slotInfo('secondary'));
  protected readonly current = computed(() =>
    this.slot() === 'primary' ? this.primary() : this.secondary(),
  );
  protected readonly isPainted = computed(() => !!this.primary().hex);
  protected readonly slotLabels = computed<[string, string]>(() => {
    if (this.mode() === 'pattern') return ['Background', 'Pattern'];
    return this.style().split?.direction === 'vertical' ? ['Left', 'Right'] : ['Top', 'Bottom'];
  });
  protected readonly finish = computed<Finish>(
    () => this.style().finish ?? (this.settings().defaultFinish as Finish) ?? 'matte',
  );

  // ---- custom colour ----
  protected readonly customHex = linkedSignal(() => this.current().hex ?? '#A7B49A');
  protected readonly customValid = computed(() => HEX.test(this.customHex()));

  constructor() {
    toObservable(this.search)
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.debouncedSearch.set(q.trim()));
  }

  protected isCurrent(color: Color): boolean {
    const s = this.style();
    return (this.slot() === 'primary' ? s.colorId : s.secondaryColorId) === color._id;
  }

  protected apply(color: Color): void {
    this.cache.remember(color);
    this.recent.add(color);
    const patch: Partial<RegionStyle> =
      this.slot() === 'primary'
        ? { colorId: color._id, customHex: undefined }
        : { secondaryColorId: color._id, secondaryCustomHex: undefined };
    this.store.setStyle(this.region().regionId, { ...this.defaults(), ...patch });
  }

  protected applyCustom(): void {
    const hex = this.customHex().toUpperCase();
    if (!HEX.test(hex)) return;
    const patch: Partial<RegionStyle> =
      this.slot() === 'primary'
        ? { customHex: hex, colorId: undefined }
        : { secondaryCustomHex: hex, secondaryColorId: undefined };
    this.store.setStyle(this.region().regionId, { ...this.defaults(), ...patch });
  }

  protected setMode(mode: Mode): void {
    const s = this.style();
    const patch: Partial<RegionStyle> = { mode };
    const base = this.primary().hex ?? '#E8E2D6';
    if (mode !== 'solid' && !this.secondary().hex) {
      // Start with a deeper shade of the main colour so the effect is visible straight away
      patch.secondaryCustomHex = shadeHex(base, mode === 'dual' ? 0.45 : 0.5);
    }
    if (mode !== 'solid' && !this.primary().hex) patch.customHex = base;
    if (mode === 'dual' && !s.split) patch.split = { direction: 'horizontal', position: 50 };
    if (mode === 'pattern' && !s.patternId) patch.patternId = this.patterns.patterns()[0]?._id;
    this.store.setStyle(this.region().regionId, { ...this.defaults(), ...patch });
  }

  protected setSplit(changes: Partial<NonNullable<RegionStyle['split']>>, done = true): void {
    const split = {
      direction: 'horizontal' as const,
      position: 50,
      ...this.style().split,
      ...changes,
    };
    this.store.setStyle(this.region().regionId, { split }, { history: done });
    if (done) this.store.endGesture();
  }

  protected setPattern(pattern: Pattern): void {
    this.store.setStyle(this.region().regionId, { patternId: pattern._id });
  }

  protected setFinish(finish: Finish): void {
    this.store.setStyle(this.region().regionId, { finish });
  }

  /** Slider drags preview live and become a single undo step when released. */
  protected adjust(
    key: 'opacity' | 'brightness' | 'patternScale' | 'patternRotation',
    value: number,
    done: boolean,
  ): void {
    this.store.setStyle(this.region().regionId, { [key]: value }, { history: done });
    if (done) this.store.endGesture();
  }

  protected setFeather(value: number, done: boolean): void {
    const region = this.region();
    this.store.setSelection(
      region.regionId,
      { ...region.selection, feather: value },
      { history: done },
    );
    if (done) this.store.endGesture();
  }

  protected removePaint(): void {
    this.store.clearStyle(this.region().regionId);
  }

  protected textOn(hex: string | undefined): string | null {
    return hex ? readableTextColor(hex) : null;
  }

  private slotInfo(slot: Slot): { hex?: string; name: string; meta?: string } {
    const s = this.style();
    const colors = this.cache.byId();
    const hex = slot === 'primary' ? primaryHex(s, colors) : secondaryHex(s, colors);
    const id = slot === 'primary' ? s.colorId : s.secondaryColorId;
    const color = id ? colors.get(id) : undefined;
    if (color) return { hex, name: color.name, meta: `${color.code} · ${color.brand}` };
    return { hex, name: hex ? 'Custom colour' : 'Not chosen' };
  }

  /** Opacity/brightness/finish keep their values; first-time paint gets defaults. */
  private defaults(): Partial<RegionStyle> {
    const s = this.style();
    return {
      mode: s.mode ?? 'solid',
      opacity: s.opacity ?? 100,
      brightness: s.brightness ?? 0,
      finish: s.finish ?? (this.settings().defaultFinish as Finish) ?? 'matte',
    };
  }
}
