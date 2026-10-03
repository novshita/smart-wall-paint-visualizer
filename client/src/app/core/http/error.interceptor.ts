import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../../shared/models/api-error.model';

/**
 * Normalises every failed HTTP call into the API's `{ status, message, errors }`
 * shape so components can always show `err.message` to the user.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((err: HttpErrorResponse) => throwError(() => toApiError(err))));

export function toApiError(err: HttpErrorResponse): ApiError {
  if (err.status === 0) {
    return {
      status: 0,
      message: 'Cannot reach the server. Check your connection and try again.',
      errors: [],
    };
  }
  const body = err.error;
  if (body && typeof body === 'object' && typeof body.message === 'string') {
    return { status: err.status, message: body.message, errors: body.errors ?? [] };
  }
  return { status: err.status, message: 'Something went wrong. Please try again.', errors: [] };
}
