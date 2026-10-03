import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Color, Page } from '../../shared/models/catalog.model';

/**
 * Library colours used by the open design, by id. Colours picked in the studio are
 * added immediately; colours already saved on walls are fetched in one batch.
 */
@Injectable()
export class ColorCache {
  private readonly http = inject(HttpClient);
  private readonly _byId = signal<ReadonlyMap<string, Color>>(new Map());
  readonly byId = this._byId.asReadonly();
  private readonly pending = new Set<string>();

  remember(color: Color): void {
    if (this._byId().get(color._id) === color) return;
    this._byId.update((m) => new Map(m).set(color._id, color));
  }

  ensure(ids: readonly string[]): void {
    const missing = [...new Set(ids)].filter(
      (id) => !this._byId().has(id) && !this.pending.has(id),
    );
    if (!missing.length) return;
    missing.forEach((id) => this.pending.add(id));

    this.http
      .get<Page<Color>>(`${environment.apiUrl}/colors`, {
        params: { ids: missing.slice(0, 100).join(','), limit: 100 },
      })
      .subscribe({
        next: (page) => {
          this._byId.update((m) => {
            const next = new Map(m);
            page.items.forEach((c) => next.set(c._id, c));
            return next;
          });
          missing.forEach((id) => this.pending.delete(id));
        },
        error: () => missing.forEach((id) => this.pending.delete(id)),
      });
  }
}
