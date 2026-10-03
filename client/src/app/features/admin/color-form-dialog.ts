import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AdminService } from '../../core/admin/admin.service';
import { AdminColor } from '../../shared/models/admin.model';
import { ApiError } from '../../shared/models/api-error.model';
import { Finish } from '../../shared/models/catalog.model';
import { applyServerErrors } from '../../shared/forms/form-errors';

const FINISHES: Finish[] = ['matte', 'satin', 'glossy'];

/** Add/edit a paint colour (FR-AD1). Closes with the saved colour. */
@Component({
  selector: 'app-color-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit colour' : 'Add colour' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="admin-dialog-form">
        @if (error(); as message) {
          <p class="form-error" role="alert">{{ message }}</p>
        }
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Code</mat-label>
            <input matInput formControlName="code" placeholder="GN-501" required />
            @if (form.controls.code.hasError('server')) {
              <mat-error>{{ form.controls.code.getError('server') }}</mat-error>
            } @else {
              <mat-error>Enter a code</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" required />
            <mat-error>Enter a name</mat-error>
          </mat-form-field>
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>HEX</mat-label>
            <input matInput formControlName="hex" placeholder="#A7B49A" required />
            <span
              matTextPrefix
              class="hex-dot"
              [style.background]="validHex() ? form.controls.hex.value : null"
            ></span>
            <mat-error>Use a HEX code like #A7B49A</mat-error>
          </mat-form-field>
          <input
            type="color"
            class="picker"
            aria-label="Pick colour"
            [value]="validHex() ? form.controls.hex.value : '#a7b49a'"
            (input)="form.controls.hex.setValue($any($event.target).value.toUpperCase())"
          />
        </div>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Family</mat-label>
            <input matInput formControlName="family" placeholder="Green" required />
            <mat-error>Enter a family</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Brand</mat-label>
            <input matInput formControlName="brand" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Room tags</mat-label>
          <input matInput formControlName="tags" placeholder="Living Room, Kitchen" />
          <mat-hint>Separate with commas</mat-hint>
        </mat-form-field>
        <fieldset class="finishes">
          <legend>Finishes</legend>
          @for (f of finishes; track f) {
            <mat-checkbox [checked]="hasFinish(f)" (change)="toggleFinish(f, $event.checked)">{{
              f
            }}</mat-checkbox>
          }
        </fieldset>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .picker {
      flex: 0 0 56px !important;
      height: 56px;
      padding: 4px;
      border: 1px solid var(--swpv-border);
      border-radius: var(--swpv-radius-sm);
      background: #fff;
    }
    .hex-dot {
      display: inline-block;
      width: 14px;
      height: 14px;
      margin-right: 6px;
      border: 1px solid rgb(0 0 0 / 15%);
      border-radius: 50%;
      vertical-align: -2px;
    }
    .finishes {
      display: flex;
      gap: var(--swpv-space-3);
      margin: 0;
      padding: 0;
      border: none;
      text-transform: capitalize;
    }
    legend {
      margin-right: var(--swpv-space-2);
      font-weight: 500;
      float: left;
      line-height: 40px;
    }
    .form-error {
      margin: 0 0 var(--swpv-space-3);
      padding: var(--swpv-space-3);
      border-radius: var(--swpv-radius-sm);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class ColorFormDialog {
  protected readonly data = inject<AdminColor | null>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ColorFormDialog, AdminColor>);
  private readonly admin = inject(AdminService);
  protected readonly finishes = FINISHES;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    code: [this.data?.code ?? '', [Validators.required, Validators.maxLength(30)]],
    name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(80)]],
    hex: [this.data?.hex ?? '', [Validators.required, Validators.pattern(/^#?[0-9a-fA-F]{6}$/)]],
    family: [this.data?.family ?? '', Validators.required],
    brand: [this.data?.brand ?? 'SWPV'],
    tags: [(this.data?.tags ?? []).join(', ')],
    finishes: [this.data?.finishes ?? [...FINISHES]],
  });

  protected validHex(): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(this.form.controls.hex.value);
  }

  protected hasFinish(f: Finish): boolean {
    return this.form.controls.finishes.value.includes(f);
  }

  protected toggleFinish(f: Finish, on: boolean): void {
    const current = this.form.controls.finishes.value.filter((x) => x !== f);
    this.form.controls.finishes.setValue(
      on ? FINISHES.filter((x) => x === f || current.includes(x)) : current,
    );
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.form.controls.finishes.value.length) {
      this.error.set('Choose at least one finish.');
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      ...v,
      tags: v.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    this.saving.set(true);
    this.error.set(null);
    this.admin.saveColor(body, this.data?._id).subscribe({
      next: (color) => this.ref.close(color),
      error: (err: ApiError) => {
        this.saving.set(false);
        if (err.status === 409) this.form.controls.code.setErrors({ server: err.message });
        else this.error.set(applyServerErrors(this.form, err));
      },
    });
  }
}
