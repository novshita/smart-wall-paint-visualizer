import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService, tokenExpiry } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from '../http/error.interceptor';
import { User } from '../../shared/models/user.model';

function fakeToken(expSecondsFromNow: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'u1', exp })}.sig`;
}

const user: User = {
  _id: 'u1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  role: 'user',
  isActive: true,
  favoriteColors: [],
  favoritePatterns: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stores the token and user on login', () => {
    const token = fakeToken(3600);
    auth.login('asha@example.com', 'Paint1234').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ token, user });

    expect(auth.token).toBe(token);
    expect(auth.user()).toEqual(user);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
  });

  it('attaches the bearer token to API calls', () => {
    localStorage.setItem('swpv.token', 'abc');
    auth.updateProfile({ name: 'X' }).subscribe();
    const req = http.expectOne('/api/v1/auth/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush({ user });
  });

  it('does not send the token to third-party URLs', async () => {
    localStorage.setItem('swpv.token', 'abc');
    const { HttpClient } = await import('@angular/common/http');
    TestBed.inject(HttpClient).get('https://example.com/data').subscribe();
    const req = http.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('restores a valid session on init', async () => {
    localStorage.setItem('swpv.token', fakeToken(3600));
    const done = auth.init();
    http.expectOne('/api/v1/auth/me').flush({ user });
    await done;
    expect(auth.user()?.email).toBe('asha@example.com');
  });

  it('discards an expired token on init without calling the API', async () => {
    localStorage.setItem('swpv.token', fakeToken(-10));
    await auth.init();
    http.expectNone('/api/v1/auth/me');
    expect(auth.token).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('ends the session and redirects to login when the API returns 401', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.login('a@b.c', 'x').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ token: fakeToken(3600), user });

    auth.updateProfile({ name: 'Y' }).subscribe({ error: () => undefined });
    http
      .expectOne('/api/v1/auth/me')
      .flush(
        { status: 401, message: 'Session expired', errors: [] },
        { status: 401, statusText: '' },
      );

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.token).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], expect.anything());
  });

  it('does not treat a failed login (401) as an expired session', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    let message = '';
    auth.login('a@b.c', 'wrong').subscribe({ error: (e) => (message = e.message) });
    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { status: 401, message: 'Invalid email or password', errors: [] },
        { status: 401, statusText: '' },
      );
    expect(message).toBe('Invalid email or password');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the session on logout', () => {
    auth.login('a@b.c', 'x').subscribe();
    http.expectOne('/api/v1/auth/login').flush({ token: fakeToken(3600), user });
    auth.logout();
    http.expectOne('/api/v1/auth/logout').flush(null);
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.token).toBeNull();
  });

  it('reads the exp claim from a JWT', () => {
    const exp = tokenExpiry(fakeToken(60));
    expect(exp).toBeGreaterThan(Date.now());
    expect(tokenExpiry('not-a-jwt')).toBeNull();
  });
});
