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
import { SettingsService } from '../../core/settings/settings.service';
import { Color, Finish } from '../../shared/models/catalog.model';
import { readableTextColor } from '../../shared/utils/color-utils';

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour and finish controls for the selected wall (FR-C1, FR-C4, FR-C8, FR-L6). */
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
  private readonly settings = inject(SettingsService).settings;

  readonly region = input.required<Region>();

  protected readonly finishes: Finish[] = ['matte', 'satin', 'glossy'];
  protected readonly recentColors = this.recent.colors;

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
  protected readonly color = computed<Color | undefined>(() => {
    const id = this.style().colorId;
    return id ? this.cache.byId().get(id) : undefined;
  });
  protected readonly hex = computed(() => this.color()?.hex ?? this.style().customHex ?? null);
  protected readonly textColor = computed(() =>
    this.hex() ? readableTextColor(this.hex()!) : null,
  );
  protected readonly finish = computed<Finish>(
    () => this.style().finish ?? (this.settings().defaultFinish as Finish) ?? 'matte',
  );

  // ---- custom colour ----
  protected readonly customHex = linkedSignal(
    () => this.style().customHex ?? this.color()?.hex ?? '#A7B49A',
  );
  protected readonly customValid = computed(() => HEX.test(this.customHex()));

  constructor() {
    toObservable(this.search)
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.debouncedSearch.set(q.trim()));
  }

  protected isCurrent(color: Color): boolean {
    return this.style().colorId === color._id;
  }

  protected apply(color: Color): void {
    this.cache.remember(color);
    this.recent.add(color);
    this.store.setStyle(this.region().regionId, {
      ...this.defaults(),
      mode: 'solid',
      colorId: color._id,
      customHex: undefined,
    });
  }

  protected applyCustom(): void {
    const hex = this.customHex().toUpperCase();
    if (!HEX.test(hex)) return;
    this.store.setStyle(this.region().regionId, {
      ...this.defaults(),
      mode: 'solid',
      customHex: hex,
      colorId: undefined,
    });
  }

  protected setFinish(finish: Finish): void {
    this.store.setStyle(this.region().regionId, { finish });
  }

  /** Slider drags preview live and become a single undo step when released. */
  protected adjust(key: 'opacity' | 'brightness', value: number, done: boolean): void {
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

  /** Opacity/brightness/finish keep their current values; first-time paint gets defaults. */
  private defaults(): Partial<RegionStyle> {
    const s = this.style();
    return {
      opacity: s.opacity ?? 100,
      brightness: s.brightness ?? 0,
      finish: s.finish ?? (this.settings().defaultFinish as Finish) ?? 'matte',
    };
  }
}
