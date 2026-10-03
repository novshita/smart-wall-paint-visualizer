import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App routing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes)] });
  });

  it('creates the root component', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it('renders the landing page inside the shell', async () => {
    const harness = await RouterTestingHarness.create('/');
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('before you paint');
  });

  it('renders the not-found page for unknown routes', async () => {
    const harness = await RouterTestingHarness.create('/does-not-exist');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Page not found');
    expect(TestBed.inject(Router).url).toBe('/does-not-exist');
  });
});
