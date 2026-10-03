import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ApiError } from '../models/api-error.model';

/**
 * Puts field-level API errors onto the matching form controls (as `{ server: message }`)
 * and returns the message to show at form level when no field matched.
 */
export function applyServerErrors(form: FormGroup, err: ApiError): string | null {
  let matched = false;
  for (const { field, message } of err.errors ?? []) {
    const control = field ? form.get(field) : null;
    if (control) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
      matched = true;
    }
  }
  return matched ? null : err.message;
}

/** Mirrors the API rule: 8–72 chars with at least one letter and one number. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** Group validator: `confirmKey` must equal `key`. Error is set on the confirm control. */
export function matchValidator(key: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const value = group.get(key)?.value;
    const confirm = group.get(confirmKey);
    if (!confirm) return null;
    const mismatch = !!confirm.value && value !== confirm.value;
    const rest = { ...confirm.errors };
    delete rest['mismatch'];
    confirm.setErrors(
      mismatch ? { ...rest, mismatch: true } : Object.keys(rest).length ? rest : null,
    );
    return null;
  };
}
