import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error.model';
import { AuthService } from './auth.service';

// Endpoints where a 401 means "wrong credentials", not "session expired"
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/logout', '/auth/password'];

/**
 * Attaches the JWT to API requests only (never to third-party URLs) and ends the
 * session when the API says the token is no longer valid.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith(environment.apiUrl);
  const token = auth.token;

  const request =
    isApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: ApiError) => {
      const isCredentialCall = CREDENTIAL_ENDPOINTS.some((path) => req.url.endsWith(path));
      if (isApi && err.status === 401 && !isCredentialCall) {
        auth.expireSession();
      }
      return throwError(() => err);
    }),
  );
};
