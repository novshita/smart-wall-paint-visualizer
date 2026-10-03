import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ExportFormat, ExportLayout } from '../../core/editor/export';

export interface DownloadOptions {
  variantId: string;
  layout: ExportLayout;
  format: ExportFormat;
  caption: boolean;
}

export interface DownloadDialogData {
  variants: { variantId: string; name: string }[];
  activeVariantId: string;
}

/** Download options: which design, painted or before/after, PNG or JPG, caption (FR-S3, FR-S5). */
@Component({
  selector: 'app-download-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatRadioModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Download your design</h2>
    <mat-dialog-content class="content">
      @if (data.variants.length > 1) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Design</mat-label>
          <mat-select [(ngModel)]="options.variantId">
            @for (v of data.variants; track v.variantId) {
              <mat-option [value]="v.variantId">{{ v.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <fieldset>
        <legend>Image</legend>
        <mat-radio-group [(ngModel)]="options.layout" aria-label="Image layout">
          <mat-radio-button value="painted">Painted room</mat-radio-button>
          <mat-radio-button value="before-after">Before &amp; after, side by side</mat-radio-button>
        </mat-radio-group>
      </fieldset>

      <fieldset>
        <legend>Format</legend>
        <mat-radio-group [(ngModel)]="options.format" aria-label="File format">
          <mat-radio-button value="jpg">JPG (smaller file)</mat-radio-button>
          <mat-radio-button value="png">PNG (best quality)</mat-radio-button>
        </mat-radio-group>
      </fieldset>

      <mat-checkbox [(ngModel)]="options.caption">
        Add colour names and codes under the image
      </mat-checkbox>

      <p class="note">
        Exported at your photo's full resolution. Colours on screen and in print may differ from
        real paint because of lighting, screen calibration and wall texture.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" (click)="confirm()">Download</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--swpv-space-4);
      min-width: min(420px, 80vw);
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: none;
    }
    legend {
      margin-bottom: var(--swpv-space-1);
      font-weight: 600;
    }
    mat-radio-group {
      display: flex;
      flex-direction: column;
    }
    .note {
      margin: 0;
      font-size: 0.8rem;
      color: var(--swpv-muted);
    }
  `,
})
export class DownloadDialog {
  protected readonly data = inject<DownloadDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DownloadDialog, DownloadOptions>);

  protected readonly options: DownloadOptions = {
    variantId: this.data.activeVariantId,
    layout: 'painted',
    format: 'jpg',
    caption: true,
  };

  protected confirm(): void {
    this.ref.close({ ...this.options });
  }
}
