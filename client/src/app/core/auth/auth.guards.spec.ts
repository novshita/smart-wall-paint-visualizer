import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component, signal } from '@angular/core';
import { adminGuard, authGuard, guestGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

@Component({ template: 'page' })
class Page {}

describe('auth guards', () => {
  const loggedIn = signal(false);
  const isAdmin = signal(false);

  beforeEach(() => {
    loggedIn.set(false);
    isAdmin.set(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: loggedIn, isAdmin } },
        provideRouter([
          { path: 'dashboard', component: Page, canActivate: [authGuard] },
          { path: 'admin', component: Page, canActivate: [adminGuard] },
          { path: 'auth/login', component: Page, canActivate: [guestGuard] },
        ]),
      ],
    });
  });

  const url = () => TestBed.inject(Router).url;

  it('sends guests to login with a returnUrl', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');
    expect(url()).toBe('/auth/login?returnUrl=%2Fdashboard');
  });

  it('lets signed-in users through', async () => {
    loggedIn.set(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');
    expect(url()).toBe('/dashboard');
  });

  it('keeps non-admins out of admin routes', async () => {
    loggedIn.set(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin');
    expect(url()).toBe('/dashboard');
  });

  it('lets admins into admin routes', async () => {
    loggedIn.set(true);
    isAdmin.set(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin');
    expect(url()).toBe('/admin');
  });

  it('redirects signed-in users away from login', async () => {
    loggedIn.set(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/auth/login');
    expect(url()).toBe('/dashboard');
  });

  it('only accepts in-app return URLs', () => {
    expect(safeReturnUrl('/profile')).toBe('/profile');
    expect(safeReturnUrl('https://evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('/auth/login')).toBe('/dashboard');
    expect(safeReturnUrl(undefined)).toBe('/dashboard');
  });

  it('guards return UrlTrees, not booleans, when redirecting', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/x' } as never),
    );
    expect(result instanceof UrlTree).toBe(true);
  });
});
