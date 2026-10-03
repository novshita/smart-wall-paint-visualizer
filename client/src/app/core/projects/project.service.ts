import { HttpClient, HttpEventType, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page } from '../../shared/models/catalog.model';
import { Project, UploadEvent } from '../../shared/models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/projects`;

  /**
   * Uploads a room photo, emitting progress then the created project.
   * Unsubscribing cancels the upload.
   */
  upload(file: File, title: string): Observable<UploadEvent> {
    const body = new FormData();
    body.append('image', file);
    body.append('title', title);
    body.append('ownershipConfirmed', 'true');

    return this.http
      .post<{ project: Project }>(this.api, body, { reportProgress: true, observe: 'events' })
      .pipe(
        map((event): UploadEvent | null => {
          if (event.type === HttpEventType.UploadProgress) {
            const percent = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            return { kind: 'progress', percent };
          }
          if (event.type === HttpEventType.Response && event.body) {
            return { kind: 'done', project: event.body.project };
          }
          return null;
        }),
        filter((e): e is UploadEvent => e !== null),
      );
  }

  /** Must be called from an injection context. */
  projects(query: () => { limit?: number; page?: number } | undefined) {
    return httpResource<Page<Project>>(() => {
      const q = query();
      return q ? { url: this.api, params: { ...q } } : undefined;
    });
  }

  /** Must be called from an injection context. */
  project(id: () => string | undefined) {
    return httpResource<{ project: Project }>(() => {
      const value = id();
      return value ? `${this.api}/${encodeURIComponent(value)}` : undefined;
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${encodeURIComponent(id)}`);
  }
}
