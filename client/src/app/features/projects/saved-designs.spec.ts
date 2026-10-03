import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { SavedDesigns } from './saved-designs';

const project = (id: string, extra: object = {}) => ({
  _id: id,
  title: `Room ${id}`,
  status: 'draft',
  thumbnailUrl: `/thumb-${id}.jpg`,
  updatedAt: '2026-10-01T10:00:00Z',
  variants: [{ variantId: 'v1', name: 'Design 1', regions: [] }],
  ...extra,
});

describe('SavedDesigns page', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'projects', component: SavedDesigns }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function open(url = '/projects') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    TestBed.tick();
    return harness;
  }

  it('shows painted previews when available and links to the right step', async () => {
    const harness = await open();
    http
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({
        items: [
          project('a', {
            status: 'saved',
            variants: [{ variantId: 'v1', name: 'D1', regions: [], renderUrl: '/render-a.jpg' }],
          }),
          project('b'),
        ],
        total: 2,
        page: 1,
        limit: 12,
        pages: 1,
      });
    await harness.fixture.whenStable();
    harness.detectChanges();

    const el = harness.routeNativeElement as HTMLElement;
    const imgs = [...el.querySelectorAll('.thumb img')].map((i) => i.getAttribute('src'));
    expect(imgs).toEqual(['/render-a.jpg', '/thumb-b.jpg']);
    const links = [...el.querySelectorAll('a.thumb')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/projects/a/studio', '/projects/b/select']);
    expect(el.textContent).toContain('Saved');
    expect(el.textContent).toContain('Draft');
  });

  it('filters by status through the URL', async () => {
    await open('/projects?status=saved');
    const req = http.expectOne((r) => r.url === '/api/v1/projects');
    expect(req.request.params.get('status')).toBe('saved');
    req.flush({ items: [], total: 0, page: 1, limit: 12, pages: 1 });
  });

  it('deletes after confirmation and reloads the list', async () => {
    const harness = await open();
    http
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({
        items: [project('a')],
        total: 1,
        page: 1,
        limit: 12,
        pages: 1,
      });
    await harness.fixture.whenStable();
    const page = harness.routeDebugElement!.componentInstance as {
      remove(p: unknown): Promise<void>;
    };
    await page.remove(project('a'));
    http.expectOne({ method: 'DELETE', url: '/api/v1/projects/a' }).flush(null);
    TestBed.tick();
    http
      .expectOne((r) => r.url === '/api/v1/projects')
      .flush({ items: [], total: 0, page: 1, limit: 12, pages: 1 });
  });
});
