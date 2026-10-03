import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { AdminService } from '../../core/admin/admin.service';
import { ActivityAction, ActivityEntry } from '../../shared/models/admin.model';

const LABELS: Record<ActivityAction, string> = {
  register: 'Signed up',
  login: 'Logged in',
  logout: 'Logged out',
  upload: 'Uploaded a photo',
  save: 'Saved a design',
  download: 'Downloaded an image',
  delete: 'Deleted a design',
  session_start: 'Started a session',
  session_end: 'Ended a session',
};

/** User activity log (FR-AD5). */
@Component({
  selector: 'app-admin-activity',
  imports: [DatePipe, MatPaginatorModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-head">
      <div>
        <h1>Activity</h1>
        <p class="muted">What users have been doing, newest first.</p>
      </div>
    </header>
    <div class="admin-toolbar">
      <select aria-label="Action" (change)="action.set($any($event.target).value); page.set(1)">
        <option value="">All actions</option>
        @for (a of actions; track a) {
          <option [value]="a">{{ labels[a] }}</option>
        }
      </select>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">User</th>
            <th scope="col">Action</th>
            <th scope="col">Design</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          @for (e of list.value()?.items ?? []; track e._id) {
            <tr>
              <td>{{ e.createdAt | date: 'medium' }}</td>
              <td>
                {{ e.userId?.name ?? 'Deleted user' }}
                <span class="muted">{{ e.userId?.email }}</span>
              </td>
              <td>{{ labels[e.action] }}</td>
              <td>{{ e.projectId?.title ?? '—' }}</td>
              <td class="muted">{{ details(e) }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="admin-empty">
                {{ list.isLoading() ? 'Loading…' : 'No activity yet.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (list.value(); as r) {
      <mat-paginator
        [length]="r.total"
        [pageSize]="r.limit"
        [pageIndex]="r.page - 1"
        [hidePageSize]="true"
        (page)="onPage($event)"
        aria-label="Choose page"
      />
    }
  `,
})
export class AdminActivity {
  protected readonly labels = LABELS;
  protected readonly actions = Object.keys(LABELS) as ActivityAction[];
  protected readonly action = signal('');
  protected readonly page = signal(1);
  protected readonly list = inject(AdminService).activity(() => ({
    action: this.action(),
    page: this.page(),
  }));

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
  }

  protected details(e: ActivityEntry): string {
    const m = e.metadata ?? {};
    if (e.action === 'download')
      return [m['format'], m['layout']].filter(Boolean).join(' · ').toUpperCase();
    if (e.action === 'session_end' && typeof m['durationSeconds'] === 'number') {
      return `${Math.round(m['durationSeconds'] / 60)} min`;
    }
    if (e.action === 'upload' && m['width']) return `${m['width']} × ${m['height']}`;
    return '';
  }
}
