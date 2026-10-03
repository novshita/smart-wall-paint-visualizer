import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProjectService } from '../../core/projects/project.service';
import { Disclaimer } from '../../shared/components/disclaimer/disclaimer';
import { ApiError } from '../../shared/models/api-error.model';

/**
 * Wall selection (spec page 5). For now this shows the uploaded photo; the polygon
 * and brush tools are built in the next step.
 */
@Component({
  selector: 'app-wall-selection',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, Disclaimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      @if (project(); as p) {
        <header class="head">
          <div>
            <h1>{{ p.title }}</h1>
            <p class="muted">
              {{ p.originalImage.width }} × {{ p.originalImage.height }} · uploaded and ready
            </p>
          </div>
          <a mat-stroked-button routerLink="/dashboard">Back to dashboard</a>
        </header>

        <img
          class="photo"
          [src]="p.workingImage.url"
          [width]="p.workingImage.width"
          [height]="p.workingImage.height"
          [alt]="'Room photo: ' + p.title"
        />

        <p class="notice" role="status">
          <mat-icon aria-hidden="true">construction</mat-icon>
          Wall selection tools (polygon and brush) are coming in the next update.
        </p>
        <app-disclaimer [compact]="true" />
      } @else if (notFound()) {
        <div class="state">
          <mat-icon aria-hidden="true">search_off</mat-icon>
          <h1>Project not found</h1>
          <p class="muted">It may have been deleted, or it belongs to another account.</p>
          <a mat-flat-button routerLink="/dashboard">Go to dashboard</a>
        </div>
      } @else if (resource.error()) {
        <div class="state" role="alert">
          <mat-icon aria-hidden="true">cloud_off</mat-icon>
          <p>We couldn't load this project.</p>
          <button mat-stroked-button type="button" (click)="resource.reload()">Retry</button>
        </div>
      } @else {
        <div class="state" aria-label="Loading project"><mat-spinner diameter="40" /></div>
      }
    </section>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: var(--swpv-space-3);
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--swpv-space-4);
    }
    .photo {
      display: block;
      width: 100%;
      height: auto;
      max-height: 70vh;
      object-fit: contain;
      border-radius: var(--swpv-radius);
      background: var(--swpv-surface-alt);
    }
    .notice {
      display: flex;
      gap: var(--swpv-space-2);
      align-items: center;
      margin: var(--swpv-space-4) 0;
      padding: var(--swpv-space-3) var(--swpv-space-4);
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius-sm);
      background: #fff;
    }
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--swpv-space-3);
      padding: var(--swpv-space-8) var(--swpv-space-4);
      text-align: center;
    }
  `,
})
export class WallSelection {
  /** Route param */
  readonly id = input.required<string>();

  protected readonly resource = inject(ProjectService).project(this.id);
  protected readonly project = computed(() =>
    this.resource.hasValue() ? this.resource.value().project : undefined,
  );
  protected readonly notFound = computed(() => {
    const status = (this.resource.error() as ApiError | undefined)?.status;
    return status === 404 || status === 400;
  });
}
