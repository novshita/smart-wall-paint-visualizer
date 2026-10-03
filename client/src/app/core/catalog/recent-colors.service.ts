import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Color } from '../../shared/models/catalog.model';

const MAX_RECENT = 12;

/** Recently used colours for quick re-selection in the studio (FR-L6), kept per user in the browser. */
@Injectable({ providedIn: 'root' })
export class RecentColorsService {
  private readonly auth = inject(AuthService);
  private readonly key = computed(() => {
    const id = this.auth.user()?._id;
    return id ? `swpv.recentColors.${id}` : null;
  });
  private readonly _colors = signal<Color[]>([]);
  readonly colors = this._colors.asReadonly();

  constructor() {
    effect(() => {
      const key = this.key();
      this._colors.set(key ? this.read(key) : []);
    });
  }

  add(color: Color): void {
    const next = [color, ...this._colors().filter((c) => c._id !== color._id)].slice(0, MAX_RECENT);
    this._colors.set(next);
    const key = this.key();
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage full or disabled: recent colours just won't persist
      }
    }
  }

  private read(key: string): Color[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
    } catch {
      return [];
    }
  }
}
