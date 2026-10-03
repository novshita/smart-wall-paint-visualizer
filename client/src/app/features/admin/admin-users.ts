import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminService } from '../../core/admin/admin.service';
import { AuthService } from '../../core/auth/auth.service';
import { AdminUser } from '../../shared/models/admin.model';
import { ApiError } from '../../shared/models/api-error.model';

/** User management (FR-AD4): roles and activation. */
@Component({
  selector: 'app-admin-users',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-head">
      <div>
        <h1>Users</h1>
        <p class="muted">Deactivated users are signed out immediately and can't log in.</p>
      </div>
    </header>
    <div class="admin-toolbar">
      <input
        class="search"
        type="search"
        placeholder="Search name or email"
        aria-label="Search users"
        [value]="search()"
        (input)="search.set($any($event.target).value)"
      />
      <select aria-label="Role" (change)="role.set($any($event.target).value); page.set(1)">
        <option value="">All roles</option>
        <option value="user">Users</option>
        <option value="admin">Admins</option>
      </select>
      <select aria-label="Status" (change)="status.set($any($event.target).value); page.set(1)">
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="inactive">Deactivated</option>
      </select>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col" class="num">Designs</th>
            <th scope="col">Last login</th>
            <th scope="col">Status</th>
            <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (u of list.value()?.items ?? []; track u._id) {
            @let self = u._id === auth.user()?._id;
            <tr [class.inactive]="!u.isActive">
              <td>
                <strong>{{ u.name }}</strong>
                @if (self) {
                  <span class="muted">(you)</span>
                }
              </td>
              <td>{{ u.email }}</td>
              <td>
                <span class="chip" [class.admin]="u.role === 'admin'">{{
                  u.role === 'admin' ? 'Admin' : 'User'
                }}</span>
              </td>
              <td class="num">
                <a [routerLink]="['/admin/designs']" [queryParams]="{ userId: u._id }">{{
                  u.projectCount
                }}</a>
              </td>
              <td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'medium') : '—' }}</td>
              <td>
                <span class="chip" [class.on]="u.isActive" [class.off]="!u.isActive">{{
                  u.isActive ? 'Active' : 'Deactivated'
                }}</span>
              </td>
              <td class="actions">
                <button
                  mat-icon-button
                  type="button"
                  [matMenuTriggerFor]="menu"
                  [disabled]="self"
                  [attr.aria-label]="'Actions for ' + u.name"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu" xPosition="before">
                  <button
                    mat-menu-item
                    (click)="update(u, { role: u.role === 'admin' ? 'user' : 'admin' })"
                  >
                    <mat-icon>admin_panel_settings</mat-icon
                    ><span>{{ u.role === 'admin' ? 'Make regular user' : 'Make admin' }}</span>
                  </button>
                  <button mat-menu-item (click)="update(u, { isActive: !u.isActive })">
                    <mat-icon>{{ u.isActive ? 'block' : 'check_circle' }}</mat-icon
                    ><span>{{ u.isActive ? 'Deactivate' : 'Activate' }}</span>
                  </button>
                </mat-menu>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="admin-empty">
                {{ list.isLoading() ? 'Loading…' : 'No users found.' }}
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
export class AdminUsers {
  private readonly admin = inject(AdminService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);

  protected readonly search = signal('');
  private readonly q = signal('');
  protected readonly role = signal('');
  protected readonly status = signal('');
  protected readonly page = signal(1);
  protected readonly list = this.admin.users(() => ({
    q: this.q(),
    role: this.role(),
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

  protected update(u: AdminUser, changes: { role?: 'user' | 'admin'; isActive?: boolean }): void {
    this.admin.updateUser(u._id, changes).subscribe({
      next: () => {
        this.list.reload();
        this.snackBar.open(`Updated ${u.name}`, undefined, { duration: 2500 });
      },
      error: (err: ApiError) => this.snackBar.open(err.message, 'OK', { duration: 4000 }),
    });
  }
}
