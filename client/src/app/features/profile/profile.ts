import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { FavoritesService } from '../../core/catalog/favorites.service';
import { SwatchCard } from '../../shared/components/swatch-card/swatch-card';
import { ApiError } from '../../shared/models/api-error.model';
import {
  PASSWORD_PATTERN,
  applyServerErrors,
  matchValidator,
} from '../../shared/forms/form-errors';

/** Account details, password (FR-A5), and favourite colours (FR-L5). */
@Component({
  selector: 'app-profile',
  imports: [
    DatePipe,
    RouterLink,
    SwatchCard,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  protected readonly auth = inject(AuthService);
  protected readonly favorites = inject(FavoritesService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly detailsForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchValidator('newPassword', 'confirmPassword') },
  );

  protected readonly savingDetails = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly detailsError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);

  constructor() {
    // Keep the details form in sync with the signed-in user
    effect(() => {
      const user = this.auth.user();
      if (user) this.detailsForm.reset({ name: user.name, email: user.email });
    });
  }

  protected saveDetails(): void {
    if (this.detailsForm.invalid || this.savingDetails()) {
      this.detailsForm.markAllAsTouched();
      return;
    }
    this.savingDetails.set(true);
    this.detailsError.set(null);

    const { name, email } = this.detailsForm.getRawValue();
    this.auth.updateProfile({ name: name.trim(), email }).subscribe({
      next: () => {
        this.savingDetails.set(false);
        this.snackBar.open('Profile updated', 'OK', { duration: 3000 });
      },
      error: (err: ApiError) => {
        this.detailsError.set(applyServerErrors(this.detailsForm, err));
        this.savingDetails.set(false);
      },
    });
  }

  protected changePassword(formDirective: FormGroupDirective): void {
    if (this.passwordForm.invalid || this.savingPassword()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.savingPassword.set(true);
    this.passwordError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.savingPassword.set(false);
        // resetForm also clears the "submitted" state so fields don't show as errors
        formDirective.resetForm();
        this.snackBar.open('Password changed. Other devices have been signed out.', 'OK', {
          duration: 4000,
        });
      },
      error: (err: ApiError) => {
        this.passwordError.set(applyServerErrors(this.passwordForm, err));
        this.savingPassword.set(false);
      },
    });
  }
}
