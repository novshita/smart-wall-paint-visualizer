import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface PromptData {
  title: string;
  label: string;
  value: string;
  maxLength?: number;
  confirmText?: string;
}

/** Single text field dialog (e.g. rename). Closes with the trimmed value. */
@Component({
  selector: 'app-prompt-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="field">
          <mat-label>{{ data.label }}</mat-label>
          <input
            matInput
            name="value"
            [(ngModel)]="value"
            [maxlength]="data.maxLength ?? 150"
            required
            cdkFocusInitial
          />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="!value.trim()">
          {{ data.confirmText ?? 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .field {
      width: min(400px, 75vw);
    }
  `,
})
export class PromptDialog {
  protected readonly data = inject<PromptData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PromptDialog, string>);
  protected value = this.data.value;

  protected submit(): void {
    if (this.value.trim()) this.ref.close(this.value.trim());
  }
}
