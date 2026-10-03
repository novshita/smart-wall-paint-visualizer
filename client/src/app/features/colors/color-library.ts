import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { CatalogService } from '../../core/catalog/catalog.service';
import { SwatchCard } from '../../shared/components/swatch-card/swatch-card';
import { Color, ColorQuery, Page } from '../../shared/models/catalog.model';

const PAGE_SIZE = 24;
type FilterKey = 'q' | 'family' | 'brand' | 'finish' | 'tag' | 'page';

/**
 * Browse/search/filter colours (FR-L1–L3). All filter state lives in the URL query
 * string, so results are shareable and the back button works.
 */
@Component({
  selector: 'app-color-library',
  imports: [
    TitleCasePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    SwatchCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-library.html',
  styleUrl: './color-library.scss',
})
export class ColorLibrary {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);

  // Query params (bound by withComponentInputBinding)
  readonly q = input<string>();
  readonly family = input<string>();
  readonly brand = input<string>();
  readonly finish = input<string>();
  readonly tag = input<string>();
  readonly page = input<string>();

  protected readonly pageSize = PAGE_SIZE;
  protected readonly facets = this.catalog.colorFacets();

  private readonly query = computed<ColorQuery>(() => ({
    q: this.q(),
    family: this.family(),
    brand: this.brand(),
    finish: this.finish(),
    tag: this.tag(),
    page: Math.max(1, Number(this.page()) || 1),
    limit: PAGE_SIZE,
  }));
  protected readonly colors = this.catalog.colors(this.query);

  /** Last successful result, kept on screen while the next page/filter loads */
  protected readonly results = linkedSignal<Page<Color> | undefined, Page<Color> | undefined>({
    source: () => (this.colors.hasValue() ? this.colors.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly hasFilters = computed(
    () => !!(this.q() || this.family() || this.brand() || this.finish() || this.tag()),
  );

  /** What the user is typing; the URL is updated after a short pause */
  protected readonly searchText = linkedSignal(() => this.q() ?? '');
  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.update({ q: q.trim() || null }, true));
  }

  protected onSearch(value: string): void {
    this.searchText.set(value);
    this.search$.next(value);
  }

  protected clearSearch(): void {
    this.searchText.set('');
    this.search$.next('');
  }

  protected setFilter(key: Exclude<FilterKey, 'q' | 'page'>, value: string | null | undefined) {
    this.update({ [key]: value || null });
  }

  protected toggleFamily(value: string): void {
    this.setFilter('family', this.family() === value ? null : value);
  }

  protected clearAll(): void {
    this.searchText.set('');
    this.router.navigate([], { queryParams: {} });
  }

  protected onPage(event: PageEvent): void {
    this.update({ page: event.pageIndex > 0 ? String(event.pageIndex + 1) : null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Any filter change resets to page 1 unless a page is given explicitly. */
  private update(changes: Partial<Record<FilterKey, string | null>>, replaceUrl = false): void {
    this.router.navigate([], {
      queryParams: { page: null, ...changes },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
