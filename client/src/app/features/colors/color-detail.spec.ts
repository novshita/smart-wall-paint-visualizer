import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ColorDetail } from './color-detail';
import { AuthService } from '../../core/auth/auth.service';

const sage = {
  _id: 'c1',
  code: 'GN-501',
  name: 'Sage Garden',
  hex: '#A7B49A',
  rgb: { r: 167, g: 180, b: 154 },
  brand: 'SWPV',
  family: 'Green',
  finishes: ['matte', 'satin', 'glossy'],
  tags: ['Kitchen'],
};

describe('ColorDetail page', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => null, isLoggedIn: () => false } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function render(id: string) {
    const fixture = TestBed.createComponent(ColorDetail);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture;
  }

  it('shows name, code, brand, HEX, RGB, finishes, tags and related colours', async () => {
    const fixture = await render('c1');
    http.expectOne('/api/v1/colors/c1').flush({ color: sage });
    await fixture.whenStable();
    fixture.detectChanges();
    const related = http.expectOne((r) => r.url === '/api/v1/colors');
    expect(related.request.params.get('family')).toBe('Green');
    related.flush({
      items: [sage, { ...sage, _id: 'c2', name: 'Olive Grove', code: 'GN-502' }],
      total: 2,
      page: 1,
      limit: 9,
      pages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Sage Garden');
    expect(text).toContain('GN-501 · SWPV');
    expect(text).toContain('#A7B49A');
    expect(text).toContain('rgb(167, 180, 154)');
    expect(text).toContain('Glossy');
    expect(text).toContain('Kitchen');
    expect(text).toContain('Olive Grove');
    expect(text).not.toContain('GN-501 · SWPVGN-501'); // current colour excluded from related
  });

  it('shows a not-found state for unknown colours', async () => {
    const fixture = await render('missing');
    http
      .expectOne('/api/v1/colors/missing')
      .flush(
        { status: 404, message: 'Colour not found', errors: [] },
        { status: 404, statusText: '' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Colour not found');
  });
});
