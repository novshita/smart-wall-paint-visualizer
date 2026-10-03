import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ApiError } from '../../shared/models/api-error.model';
import { Color, Favorites } from '../../shared/models/catalog.model';

/**
 * The signed-in user's favourite colours (FR-L5). Loaded on login, cleared on logout,
 * and updated optimistically so the heart responds instantly.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly api = `${environment.apiUrl}/me/favorites`;

  private readonly _colors = signal<Color[]>([]);
  readonly colors = this._colors.asReadonly();
  readonly loading = signal(false);
  private readonly colorIds = computed(() => new Set(this._colors().map((c) => c._id)));

  constructor() {
    effect(() => {
      const userId = this.auth.user()?._id;
      untracked(() => (userId ? this.load() : this._colors.set([])));
    });
  }

  isFavorite(colorId: string): boolean {
    return this.colorIds().has(colorId);
  }

  load(): void {
    this.loading.set(true);
    this.http.get<Favorites>(this.api).subscribe({
      next: (fav) => {
        this._colors.set(fav.colors);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Adds or removes a favourite. Guests are sent to log in first. */
  toggle(color: Color): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const wasFavorite = this.isFavorite(color._id);
    const previous = this._colors();
    this._colors.set(
      wasFavorite ? previous.filter((c) => c._id !== color._id) : [...previous, color],
    );

    const url = `${this.api}/colors/${color._id}`;
    const request = wasFavorite ? this.http.delete(url) : this.http.post(url, {});
    request.subscribe({
      error: (err: ApiError) => {
        this._colors.set(previous);
        this.snackBar.open(`Couldn't update favourites: ${err.message}`, 'OK', {
          duration: 4000,
        });
      },
    });
  }
}
