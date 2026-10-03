import { HttpClient, HttpParams, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ActivityEntry,
  AdminColor,
  AdminProject,
  AdminSettings,
  AdminUser,
  Analytics,
  ImportResult,
} from '../../shared/models/admin.model';
import { Page, Pattern } from '../../shared/models/catalog.model';
import { User } from '../../shared/models/user.model';

type Query = Record<string, string | number | boolean | undefined | null>;

function params(query: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  }
  return p;
}

/** Admin API (spec §10.5). Resource factories must be called from an injection context. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // ---- reads (resources) ----
  analytics(days: () => number) {
    return httpResource<Analytics>(() => ({
      url: `${this.api}/admin/analytics`,
      params: { days: days() },
    }));
  }

  users(query: () => Query) {
    return httpResource<Page<AdminUser>>(() => ({
      url: `${this.api}/admin/users`,
      params: params(query()),
    }));
  }

  colors(query: () => Query) {
    return httpResource<Page<AdminColor>>(() => ({
      url: `${this.api}/admin/colors`,
      params: params(query()),
    }));
  }

  patterns(query: () => Query) {
    return httpResource<Page<Pattern & { isActive: boolean }>>(() => ({
      url: `${this.api}/admin/patterns`,
      params: params(query()),
    }));
  }

  projects(query: () => Query) {
    return httpResource<Page<AdminProject>>(() => ({
      url: `${this.api}/admin/projects`,
      params: params(query()),
    }));
  }

  activity(query: () => Query) {
    return httpResource<Page<ActivityEntry>>(() => ({
      url: `${this.api}/admin/activity`,
      params: params(query()),
    }));
  }

  settings() {
    return httpResource<{ settings: AdminSettings }>(() => `${this.api}/admin/settings`);
  }

  // ---- writes ----
  updateUser(id: string, changes: Partial<Pick<User, 'role' | 'isActive'>>): Observable<User> {
    return this.http
      .patch<{ user: User }>(`${this.api}/admin/users/${id}`, changes)
      .pipe(map((r) => r.user));
  }

  saveColor(color: Partial<AdminColor>, id?: string): Observable<AdminColor> {
    const req = id
      ? this.http.put<{ color: AdminColor }>(`${this.api}/colors/${id}`, color)
      : this.http.post<{ color: AdminColor }>(`${this.api}/colors`, color);
    return req.pipe(map((r) => r.color));
  }

  setColorActive(color: AdminColor, isActive: boolean): Observable<AdminColor> {
    return isActive
      ? this.saveColor({ isActive: true }, color._id)
      : this.http
          .delete<{ color: AdminColor }>(`${this.api}/colors/${color._id}`)
          .pipe(map((r) => r.color));
  }

  importColors(file: File): Observable<ImportResult> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ImportResult>(`${this.api}/colors/import`, body);
  }

  savePattern(
    fields: Record<string, string | boolean>,
    image: File | null,
    id?: string,
  ): Observable<Pattern> {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, String(v));
    if (image) body.append('image', image);
    const req = id
      ? this.http.put<{ pattern: Pattern }>(`${this.api}/patterns/${id}`, body)
      : this.http.post<{ pattern: Pattern }>(`${this.api}/patterns`, body);
    return req.pipe(map((r) => r.pattern));
  }

  setPatternActive(id: string, isActive: boolean): Observable<Pattern> {
    if (!isActive) {
      return this.http
        .delete<{ pattern: Pattern }>(`${this.api}/patterns/${id}`)
        .pipe(map((r) => r.pattern));
    }
    return this.savePattern({ isActive: true }, null, id);
  }

  saveSettings(settings: Partial<AdminSettings>): Observable<AdminSettings> {
    return this.http
      .put<{ settings: AdminSettings }>(`${this.api}/admin/settings`, settings)
      .pipe(map((r) => r.settings));
  }
}
