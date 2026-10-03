import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FavoritesService } from '../../../core/catalog/favorites.service';
import { Color } from '../../models/catalog.model';

@Component({
  selector: 'app-favorite-button',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      class="fav"
      [class.on]="isFavorite()"
      [attr.aria-pressed]="isFavorite()"
      [attr.aria-label]="label()"
      [matTooltip]="label()"
      (click)="toggle($event)"
    >
      <mat-icon [class.filled]="isFavorite()">favorite</mat-icon>
    </button>
  `,
  styles: `
    .fav {
      color: var(--swpv-muted);
    }
    .fav.on {
      color: #d6455d;
    }
    .filled {
      font-variation-settings: 'FILL' 1;
    }
  `,
})
export class FavoriteButton {
  private readonly favorites = inject(FavoritesService);
  readonly color = input.required<Color>();

  protected readonly isFavorite = computed(() => this.favorites.isFavorite(this.color()._id));
  protected readonly label = computed(() =>
    this.isFavorite()
      ? `Remove ${this.color().name} from favourites`
      : `Add ${this.color().name} to favourites`,
  );

  protected toggle(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.favorites.toggle(this.color());
  }
}
