import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AdminService } from '../../core/admin/admin.service';
import { ApiError } from '../../shared/models/api-error.model';
import { ImportResult } from '../../shared/models/admin.model';

/** Bulk colour import from CSV/JSON (FR-AD3), with a per-row error report. */
@Component({
  selector: 'app-import-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Import colours</h2>
    <mat-dialog-content class="content">
      <p>
        Upload a <strong>CSV</strong> with the header
        <code>code,name,hex,family,brand,finishes,tags</code> (separate several finishes or tags
        with <code>;</code>), or a <strong>JSON</strong> array of colours. Existing codes are
        updated.
      </p>
      <a [href]="templateHref" download="colour-import-template.csv">Download a CSV template</a>

      <div class="pick">
        <button mat-stroked-button type="button" (click)="file.click()" [disabled]="busy()">
          <mat-icon>upload_file</mat-icon> Choose file
        </button>
        <span class="muted">{{ fileName() ?? 'No file chosen' }}</span>
        <input
          #file
          type="file"
          class="visually-hidden"
          accept=".csv,.json,text/csv,application/json"
          (change)="upload($event)"
        />
      </div>

      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (error(); as message) {
        <p class="error" role="alert">{{ message }}</p>
      }
      @if (result(); as r) {
        <div class="result" role="status">
          <p>
            <strong>{{ r.created }}</strong> added · <strong>{{ r.updated }}</strong> updated ·
            <strong>{{ r.errors.length }}</strong> skipped
          </p>
          @if (r.errors.length) {
            <ul class="errors">
              @for (e of r.errors.slice(0, 50); track $index) {
                <li>Row {{ e.row }}: {{ e.message }}</li>
              }
            </ul>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" [mat-dialog-close]="!!result()">Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--swpv-space-3);
      max-width: 560px;
    }
    .pick {
      display: flex;
      align-items: center;
      gap: var(--swpv-space-3);
    }
    .error {
      color: var(--mat-sys-error);
    }
    .errors {
      max-height: 180px;
      margin: 0;
      padding-left: var(--swpv-space-5);
      overflow: auto;
      font-size: 0.85rem;
      color: var(--mat-sys-error);
    }
    code {
      font-size: 0.85em;
    }
  `,
})
export class ImportDialog {
  private readonly admin = inject(AdminService);
  protected readonly busy = signal(false);
  protected readonly fileName = signal<string | null>(null);
  protected readonly result = signal<ImportResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly templateHref =
    'data:text/csv;charset=utf-8,' +
    encodeURIComponent(
      'code,name,hex,family,brand,finishes,tags\nGN-510,Fern Glade,#6E8B5E,Green,SWPV,matte;satin,Living Room;Bedroom\n',
    );

  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.fileName.set(file.name);
    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    this.admin.importColors(file).subscribe({
      next: (r) => {
        this.result.set(r);
        this.busy.set(false);
      },
      error: (err: ApiError) => {
        this.error.set(err.message);
        this.busy.set(false);
      },
    });
  }
}
