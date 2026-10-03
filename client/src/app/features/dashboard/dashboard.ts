import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { SwatchCard } from '../../shared/components/swatch-card/swatch-card';
import { FavoritesService } from '../../core/catalog/favorites.service';

/**
 * Signed-in home. Recent projects are filled in once upload and saving exist.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatIconModule, Disclaimer, SwatchCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly favorites = inject(FavoritesService);

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly favoriteColors = computed(() => this.favorites.colors().slice(0, 6));
  protected readonly favoriteCount = computed(() => this.favorites.colors().length);
}
