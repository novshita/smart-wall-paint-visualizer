import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ColorLibrary } from './color-library';
import { AuthService } from '../../core/auth/auth.service';

const facets = {
  families: [{ value: 'Green', count: 1, sampleHex: '#A7B49A' }],
  brands: [{ value: 'SWPV', count: 1 }],
  tags: [{ value: 'Kitchen', count: 1 }],
  finishes: [{ value: 'matte', count: 1 }],
};

const page = (items: unknown[]) => ({ items, total: items.length, page: 1, limit: 24, pages: 1 });

describe('ColorLibrary page', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'colors', component: ColorLibrary }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => null, isLoggedIn: () => false } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('passes URL filters to the API and renders results', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/colors?family=Green&q=sage&page=2');
    TestBed.tick();

    http.expectOne('/api/v1/colors/facets').flush(facets);
    const req = http.expectOne((r) => r.url === '/api/v1/colors');
    expect(req.request.params.get('family')).toBe('Green');
    expect(req.request.params.get('q')).toBe('sage');
    expect(req.request.params.get('page')).toBe('2');
    req.flush(
      page([
        {
          _id: 'c1',
          code: 'GN-501',
          name: 'Sage Garden',
          hex: '#A7B49A',
          rgb: { r: 167, g: 180, b: 154 },
          brand: 'SWPV',
          family: 'Green',
          finishes: ['matte'],
          tags: [],
        },
      ]),
    );
    await harness.fixture.whenStable();
    harness.detectChanges();

    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('Sage Garden');
    expect(el.textContent).toContain('GN-501 · SWPV');
    expect(el.querySelector('.family.active')?.textContent).toContain('Green');
  });

  it('shows an empty state when nothing matches', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/colors?q=zzz');
    TestBed.tick();
    http.expectOne('/api/v1/colors/facets').flush(facets);
    http.expectOne((r) => r.url === '/api/v1/colors').flush(page([]));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      'No colours match your search',
    );
  });
});
