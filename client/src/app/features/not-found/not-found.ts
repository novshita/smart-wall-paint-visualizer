import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page center">
      <h1>Page not found</h1>
      <p class="muted">The page you were looking for doesn't exist or has moved.</p>
      <a mat-flat-button routerLink="/">Back to home</a>
    </section>
  `,
  styles: `
    .center {
      text-align: center;
      padding-top: var(--swpv-space-8);
    }
  `,
})
export class NotFound {}
