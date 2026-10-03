import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogService } from '../../core/catalog/catalog.service';
import { FavoritesService } from '../../core/catalog/favorites.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { SwatchCard } from '../../shared/components/swatch-card/swatch-card';
import { ApiError } from '../../shared/models/api-error.model';
import { formatRgb, readableTextColor } from '../../shared/utils/color-utils';

/** Swatch detail (FR-L4): name, code, HEX/RGB, finishes, and a "Try on my room" action. */
@Component({
  selector: 'app-color-detail',
  imports: [
    TitleCasePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    Disclaimer,
    SwatchCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './color-detail.html',
  styleUrl: './color-detail.scss',
})
export class ColorDetail {
  private readonly catalog = inject(CatalogService);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  private readonly title = inject(Title);
  protected readonly favorites = inject(FavoritesService);

  /** Route param */
  readonly id = input.required<string>();

  protected readonly resource = this.catalog.color(this.id);
  protected readonly color = computed(() =>
    this.resource.hasValue() ? this.resource.value().color : undefined,
  );
  protected readonly notFound = computed(() => {
    const status = (this.resource.error() as ApiError | undefined)?.status;
    return status === 404 || status === 400;
  });
  protected readonly textColor = computed(() => {
    const c = this.color();
    return c ? readableTextColor(c.hex) : undefined;
  });
  protected readonly rgb = computed(() => {
    const c = this.color();
    return c ? formatRgb(c.rgb) : '';
  });

  private readonly familyColors = this.catalog.colors(() => {
    const c = this.color();
    return c ? { family: c.family, limit: 9 } : undefined;
  });
  protected readonly related = computed(() => {
    const current = this.color();
    if (!current || !this.familyColors.hasValue()) return [];
    return this.familyColors
      .value()
      .items.filter((c) => c._id !== current._id)
      .slice(0, 8);
  });

  constructor() {
    // Show the colour name in the browser tab once it has loaded
    effect(() => {
      const c = this.color();
      if (c) this.title.setTitle(`${c.name} (${c.code}) · Wall Visualizer`);
    });
  }

  protected copy(value: string, label: string): void {
    const ok = this.clipboard.copy(value);
    this.snackBar.open(ok ? `${label} copied: ${value}` : `Couldn't copy ${label}`, undefined, {
      duration: 2000,
    });
  }
}
