import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResult, User } from '../../shared/models/user.model';

const TOKEN_KEY = 'swpv.token';

/**
 * Holds the logged-in user and JWT. The token lives in localStorage so a refresh
 * keeps you signed in; it is cleared on logout, on expiry, and on any 401.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = `${environment.apiUrl}/auth`;

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  private expiryTimer?: ReturnType<typeof setTimeout>;

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Restores the session on app start. Runs before the first navigation. */
  async init(): Promise<void> {
    const token = this.token;
    if (!token || isExpired(token)) {
      this.clearSession();
      return;
    }
    try {
      const { user } = await firstValueFrom(this.http.get<{ user: User }>(`${this.api}/me`));
      this._user.set(user);
      this.scheduleExpiry(token);
    } catch {
      this.clearSession();
    }
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<AuthResult>(`${this.api}/login`, { email, password }).pipe(
      tap((res) => this.startSession(res)),
      map((res) => res.user),
    );
  }

  register(name: string, email: string, password: string): Observable<User> {
    return this.http.post<AuthResult>(`${this.api}/register`, { name, email, password }).pipe(
      tap((res) => this.startSession(res)),
      map((res) => res.user),
    );
  }

  updateProfile(changes: Partial<Pick<User, 'name' | 'email'>>): Observable<User> {
    return this.http.patch<{ user: User }>(`${this.api}/me`, changes).pipe(
      map((res) => res.user),
      tap((user) => this._user.set(user)),
    );
  }

  /** Server invalidates all older tokens and returns a fresh one for this session. */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .patch<AuthResult>(`${this.api}/password`, { currentPassword, newPassword })
      .pipe(
        tap((res) => this.startSession(res)),
        map(() => undefined),
      );
  }

  logout(): void {
    if (this.token) {
      // Best effort: records the event server-side; the session ends locally regardless
      this.http.post(`${this.api}/logout`, {}).subscribe({ error: () => undefined });
    }
    this.clearSession();
    this.router.navigateByUrl('/');
  }

  /** Called when the token expires or the API answers 401. */
  expireSession(): void {
    if (!this.isLoggedIn() && !this.token) return;
    const returnUrl = this.router.url;
    this.clearSession();
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl, reason: 'expired' } });
  }

  private startSession({ token, user }: AuthResult): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._user.set(user);
    this.scheduleExpiry(token);
  }

  private clearSession(): void {
    clearTimeout(this.expiryTimer);
    localStorage.removeItem(TOKEN_KEY);
    this._user.set(null);
  }

  private scheduleExpiry(token: string): void {
    clearTimeout(this.expiryTimer);
    const exp = tokenExpiry(token);
    if (exp === null) return;
    // setTimeout overflows above ~24.8 days; tokens are far shorter-lived than that
    const delay = Math.min(exp - Date.now(), 2 ** 31 - 1);
    this.expiryTimer = setTimeout(() => this.expireSession(), Math.max(delay, 0));
  }
}

/** Reads the `exp` claim (ms since epoch) without verifying; the server does the verifying. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const exp = tokenExpiry(token);
  return exp === null || exp <= Date.now();
}
