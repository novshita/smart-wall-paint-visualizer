import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminService } from '../../core/admin/admin.service';
import { AdminColor } from '../../shared/models/admin.model';
import { ApiError } from '../../shared/models/api-error.model';
import { ColorFormDialog } from './color-form-dialog';
import { ImportDialog } from './import-dialog';

/** Paint colour catalogue management (FR-AD1, FR-AD3). */
@Component({
  selector: 'app-admin-colors',
  imports: [MatButtonModule, MatIconModule, MatPaginatorModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-head">
      <div>
        <h1>Colours</h1>
        <p class="muted">Changes appear in the colour library straight away.</p>
      </div>
      <div class="buttons">
        <button mat-stroked-button type="button" (click)="openImport()">
          <mat-icon>upload_file</mat-icon> Import
        </button>
        <button mat-flat-button type="button" (click)="edit(null)">
          <mat-icon>add</mat-icon> Add colour
        </button>
      </div>
    </header>

    <div class="admin-toolbar">
      <input
        class="search"
        type="search"
        placeholder="Search name, code or HEX"
        aria-label="Search colours"
        [value]="search()"
        (input)="search.set($any($event.target).value)"
      />
      <select
        aria-label="Status"
        [value]="status()"
        (change)="status.set($any($event.target).value); page.set(1)"
      >
        <option value="all">All colours</option>
        <option value="active">Active</option>
        <option value="inactive">Removed</option>
      </select>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th scope="col">Colour</th>
            <th scope="col">Code</th>
            <th scope="col">Family</th>
            <th scope="col">Brand</th>
            <th scope="col">Tags</th>
            <th scope="col">Status</th>
            <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (c of list.value()?.items ?? []; track c._id) {
            <tr [class.inactive]="!c.isActive">
              <td>
                <span class="sw" [style.background]="c.hex" aria-hidden="true"></span>
                <strong>{{ c.name }}</strong> <span class="muted mono">{{ c.hex }}</span>
              </td>
              <td>{{ c.code }}</td>
              <td>{{ c.family }}</td>
              <td>{{ c.brand }}</td>
              <td class="tags">{{ c.tags.join(', ') }}</td>
              <td>
                <span class="chip" [class.on]="c.isActive" [class.off]="!c.isActive">{{
                  c.isActive ? 'Active' : 'Removed'
                }}</span>
              </td>
              <td class="actions">
                <button
                  mat-icon-button
                  type="button"
                  (click)="edit(c)"
                  [attr.aria-label]="'Edit ' + c.name"
                  matTooltip="Edit"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                @if (c.isActive) {
                  <button
                    mat-icon-button
                    type="button"
                    (click)="setActive(c, false)"
                    [attr.aria-label]="'Remove ' + c.name"
                    matTooltip="Remove from library"
                  >
                    <mat-icon>visibility_off</mat-icon>
                  </button>
                } @else {
                  <button
                    mat-icon-button
                    type="button"
                    (click)="setActive(c, true)"
                    [attr.aria-label]="'Restore ' + c.name"
                    matTooltip="Restore"
                  >
                    <mat-icon>restore</mat-icon>
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="admin-empty">
                {{ list.isLoading() ? 'Loading…' : 'No colours found.' }}
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
  styles: `
    .buttons {
      display: flex;
      gap: var(--swpv-space-2);
    }
    .sw {
      display: inline-block;
      width: 18px;
      height: 18px;
      margin-right: 8px;
      border: 1px solid rgb(0 0 0 / 15%);
      border-radius: 4px;
      vertical-align: -4px;
    }
    .mono {
      margin-left: var(--swpv-space-2);
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
    }
    .tags {
      max-width: 220px;
      color: var(--swpv-muted);
    }
  `,
})
export class AdminColors {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly search = signal('');
  private readonly q = signal('');
  protected readonly status = signal('all');
  protected readonly page = signal(1);
  protected readonly list = this.admin.colors(() => ({
    q: this.q(),
    status: this.status(),
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

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
  }

  protected edit(color: AdminColor | null): void {
    this.dialog
      .open(ColorFormDialog, { data: color })
      .afterClosed()
      .subscribe((saved) => {
        if (!saved) return;
        this.list.reload();
        this.snackBar.open(color ? 'Colour updated' : 'Colour added', undefined, {
          duration: 2500,
        });
      });
  }

  protected openImport(): void {
    this.dialog
      .open(ImportDialog)
      .afterClosed()
      .subscribe((imported) => imported && this.list.reload());
  }

  protected setActive(color: AdminColor, active: boolean): void {
    this.admin.setColorActive(color, active).subscribe({
      next: () => {
        this.list.reload();
        this.snackBar.open(
          active ? `Restored ${color.name}` : `Removed ${color.name} from the library`,
          undefined,
          {
            duration: 2500,
          },
        );
      },
      error: (err: ApiError) => this.snackBar.open(err.message, 'OK', { duration: 4000 }),
    });
  }
}
