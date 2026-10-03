import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** Admin panel frame (spec page 11): side navigation + routed section. */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin">
      <nav class="side" aria-label="Admin">
        <h2 class="side-title">Admin</h2>
        @for (link of links; track link.path) {
          <a
            [routerLink]="link.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: link.path === '/admin' }"
            ariaCurrentWhenActive="page"
          >
            <mat-icon aria-hidden="true">{{ link.icon }}</mat-icon>
            {{ link.label }}
          </a>
        }
      </nav>
      <section class="content">
        <router-outlet />
      </section>
    </div>
  `,
  styles: `
    .admin {
      display: grid;
      grid-template-columns: 220px 1fr;
      min-height: calc(100dvh - var(--swpv-header-height));
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--swpv-space-4) var(--swpv-space-3);
      border-right: 1px solid var(--swpv-border);
      background: #fff;
    }
    .side-title {
      margin: 0 var(--swpv-space-3) var(--swpv-space-3);
      font-size: 0.8rem;
      color: var(--swpv-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .side a {
      display: flex;
      align-items: center;
      gap: var(--swpv-space-3);
      min-height: 44px;
      padding: 0 var(--swpv-space-3);
      border-radius: var(--swpv-radius-sm);
      color: var(--swpv-ink);
      text-decoration: none;
      font-weight: 500;
    }
    .side a:hover {
      background: var(--swpv-surface-alt);
    }
    .side a.active {
      background: #e6f1f2;
      color: var(--swpv-brand-dark);
    }
    .content {
      min-width: 0;
      padding: var(--swpv-space-5) var(--swpv-space-6) var(--swpv-space-7);
    }
    @media (max-width: 1023px) {
      .admin {
        grid-template-columns: 1fr;
      }
      .side {
        flex-direction: row;
        overflow-x: auto;
        border-right: none;
        border-bottom: 1px solid var(--swpv-border);
      }
      .side-title {
        display: none;
      }
      .side a {
        flex-shrink: 0;
      }
      .content {
        padding: var(--swpv-space-4);
      }
    }
  `,
})
export class AdminShell {
  protected readonly links = [
    { path: '/admin', label: 'Dashboard', icon: 'monitoring' },
    { path: '/admin/colors', label: 'Colours', icon: 'palette' },
    { path: '/admin/patterns', label: 'Patterns', icon: 'texture' },
    { path: '/admin/users', label: 'Users', icon: 'group' },
    { path: '/admin/designs', label: 'Designs', icon: 'photo_library' },
    { path: '/admin/activity', label: 'Activity', icon: 'history' },
    { path: '/admin/settings', label: 'Settings', icon: 'settings' },
  ];
}
