import { HttpParams, httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Color, ColorFacets, ColorQuery, Page } from '../../shared/models/catalog.model';

/**
 * Read access to the colour/pattern catalogue. Methods return `httpResource`s, so
 * they must be called from an injection context (e.g. a component field initialiser).
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = environment.apiUrl;

  colors(query: () => ColorQuery | undefined) {
    return httpResource<Page<Color>>(() => {
      const q = query();
      return q ? { url: `${this.api}/colors`, params: toParams(q) } : undefined;
    });
  }

  color(id: () => string | undefined) {
    return httpResource<{ color: Color }>(() => {
      const value = id();
      return value ? `${this.api}/colors/${encodeURIComponent(value)}` : undefined;
    });
  }

  colorFacets() {
    return httpResource<ColorFacets>(() => `${this.api}/colors/facets`);
  }
}

function toParams(query: ColorQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
