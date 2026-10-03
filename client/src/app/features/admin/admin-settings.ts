import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminService } from '../../core/admin/admin.service';
import { ApiError } from '../../shared/models/api-error.model';

/** System configuration (FR-AD6): upload limits, formats, default finish, disclaimer. */
@Component({
  selector: 'app-admin-settings',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="admin-head">
      <div>
        <h1>Settings</h1>
        <p class="muted">Changes apply to everyone straight away.</p>
      </div>
    </header>
    <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-form-field appearance="outline">
        <mat-label>Maximum upload size (MB)</mat-label>
        <input matInput type="number" min="1" max="25" formControlName="maxUploadMb" />
        <mat-hint>Between 1 and 25 MB</mat-hint>
        <mat-error>Enter a size between 1 and 25 MB</mat-error>
      </mat-form-field>

      <fieldset>
        <legend>Allowed photo formats</legend>
        <mat-checkbox
          [checked]="allows('image/jpeg')"
          (change)="setFormat('image/jpeg', $event.checked)"
          >JPG</mat-checkbox
        >
        <mat-checkbox
          [checked]="allows('image/png')"
          (change)="setFormat('image/png', $event.checked)"
          >PNG</mat-checkbox
        >
        @if (!form.controls.allowedFormats.value.length) {
          <p class="error">Allow at least one format.</p>
        }
      </fieldset>

      <mat-form-field appearance="outline">
        <mat-label>Default paint finish</mat-label>
        <mat-select formControlName="defaultFinish">
          <mat-option value="matte">Matte</mat-option>
          <mat-option value="satin">Satin</mat-option>
          <mat-option value="glossy">Glossy</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Colour accuracy disclaimer</mat-label>
        <textarea matInput rows="3" maxlength="300" formControlName="disclaimerText"></textarea>
        <mat-hint align="end">{{ form.controls.disclaimerText.value.length }} / 300</mat-hint>
        <mat-error>Write at least 10 characters</mat-error>
      </mat-form-field>

      <div class="buttons">
        <button mat-flat-button type="submit" [disabled]="saving() || form.pristine">
          {{ saving() ? 'Saving…' : 'Save settings' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: var(--swpv-space-2);
      max-width: 620px;
      padding: var(--swpv-space-5);
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius);
      background: #fff;
    }
    fieldset {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--swpv-space-3);
      margin: 0 0 var(--swpv-space-3);
      padding: 0;
      border: none;
    }
    legend {
      width: 100%;
      margin-bottom: 4px;
      font-weight: 500;
    }
    .error {
      width: 100%;
      margin: 0;
      color: var(--mat-sys-error);
      font-size: 0.85rem;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class AdminSettings {
  private readonly admin = inject(AdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly resource = this.admin.settings();
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    maxUploadMb: [10, [Validators.required, Validators.min(1), Validators.max(25)]],
    allowedFormats: [['image/jpeg', 'image/png'] as string[]],
    defaultFinish: ['matte'],
    disclaimerText: [
      '',
      [Validators.required, Validators.minLength(10), Validators.maxLength(300)],
    ],
  });

  constructor() {
    effect(() => {
      if (this.resource.hasValue()) this.form.reset(this.resource.value().settings);
    });
  }

  protected allows(format: string): boolean {
    return this.form.controls.allowedFormats.value.includes(format);
  }

  protected setFormat(format: string, on: boolean): void {
    const rest = this.form.controls.allowedFormats.value.filter((f) => f !== format);
    this.form.controls.allowedFormats.setValue(on ? [...rest, format] : rest);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid || !this.form.controls.allowedFormats.value.length) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.admin.saveSettings(this.form.getRawValue()).subscribe({
      next: (settings) => {
        this.form.reset(settings);
        this.saving.set(false);
        this.snackBar.open('Settings saved', undefined, { duration: 2500 });
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.snackBar.open(err.message, 'OK', { duration: 4000 });
      },
    });
  }
}
