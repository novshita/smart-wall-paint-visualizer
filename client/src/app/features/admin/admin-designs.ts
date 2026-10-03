import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { AdminService } from '../../core/admin/admin.service';
import { AdminProject } from '../../shared/models/admin.model';

/** All users' designs, read-only (FR-AD5). */
@Component({
  selector: 'app-admin-designs',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatPaginatorModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-head">
      <div>
        <h1>Designs</h1>
        <p class="muted">Read-only view of every user's designs.</p>
      </div>
    </header>
    <div class="admin-toolbar">
      <input
        class="search"
        type="search"
        placeholder="Search by title"
        aria-label="Search designs"
        [value]="search()"
        (input)="search.set($any($event.target).value)"
      />
      <select aria-label="Status" (change)="status.set($any($event.target).value); page.set(1)">
        <option value="">Any status</option>
        <option value="draft">Drafts</option>
        <option value="saved">Saved</option>
      </select>
      @if (userId()) {
        <span class="chip">Filtered to one user</span>
      }
    </div>
    <ul class="grid">
      @for (p of list.value()?.items ?? []; track p._id) {
        <li class="card">
          <img [src]="thumb(p)" alt="" loading="lazy" />
          <div class="info">
            <strong>{{ p.title }}</strong>
            <span class="muted">{{ p.owner?.name }} · {{ p.owner?.email }}</span>
            <span class="muted">
              <span class="chip" [class.on]="p.status === 'saved'">{{
                p.status === 'saved' ? 'Saved' : 'Draft'
              }}</span>
              {{ p.variants.length }} design{{ p.variants.length === 1 ? '' : 's' }} ·
              {{ p.updatedAt | date: 'mediumDate' }}
            </span>
          </div>
        </li>
      } @empty {
        <li class="admin-empty">{{ list.isLoading() ? 'Loading…' : 'No designs found.' }}</li>
      }
    </ul>
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
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--swpv-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .card {
      overflow: hidden;
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius);
      background: #fff;
    }
    img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: var(--swpv-surface-alt);
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--swpv-space-3);
      font-size: 0.85rem;
    }
  `,
})
export class AdminDesigns {
  private readonly admin = inject(AdminService);
  /** ?userId= from the Users page */
  readonly userId = input<string>();

  protected readonly search = signal('');
  private readonly q = signal('');
  protected readonly status = signal('');
  protected readonly page = signal(1);
  protected readonly list = this.admin.projects(() => ({
    q: this.q(),
    status: this.status(),
    userId: this.userId(),
    page: this.page(),
  }));

  constructor() {
    toObservable(this.search)
      .pipe(debounceTime(250), takeUntilDestroyed())
      .subscribe((v) => {
        this.q.set(v.trim());
        this.page.set(1);
      });
  }

  protected thumb(p: AdminProject): string {
    return p.variants.find((v) => v.renderUrl)?.renderUrl ?? p.thumbnailUrl;
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
  }
}
