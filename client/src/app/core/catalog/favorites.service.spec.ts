import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { FavoritesService } from './favorites.service';
import { AuthService } from '../auth/auth.service';
import { Color } from '../../shared/models/catalog.model';

const sage: Color = {
  _id: 'c1',
  code: 'GN-501',
  name: 'Sage Garden',
  hex: '#A7B49A',
  rgb: { r: 167, g: 180, b: 154 },
  brand: 'SWPV',
  family: 'Green',
  finishes: ['matte'],
  tags: [],
};

describe('FavoritesService', () => {
  const user = signal<{ _id: string } | null>(null);
  let http: HttpTestingController;
  let service: FavoritesService;

  function setup(loggedIn: boolean) {
    user.set(loggedIn ? { _id: 'u1' } : null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user, isLoggedIn: () => user() !== null } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FavoritesService);
    TestBed.tick(); // run the load-on-login effect
  }

  afterEach(() => http.verify());

  it('loads favourites when a user is signed in', () => {
    setup(true);
    http.expectOne('/api/v1/me/favorites').flush({ colors: [sage], patterns: [] });
    expect(service.isFavorite('c1')).toBe(true);
  });

  it('toggles optimistically and calls the API', () => {
    setup(true);
    http.expectOne('/api/v1/me/favorites').flush({ colors: [], patterns: [] });

    service.toggle(sage);
    expect(service.isFavorite('c1')).toBe(true);
    http
      .expectOne({ method: 'POST', url: '/api/v1/me/favorites/colors/c1' })
      .flush({ ids: ['c1'] });

    service.toggle(sage);
    expect(service.isFavorite('c1')).toBe(false);
    http.expectOne({ method: 'DELETE', url: '/api/v1/me/favorites/colors/c1' }).flush({ ids: [] });
  });

  it('rolls back when the API call fails', () => {
    setup(true);
    http.expectOne('/api/v1/me/favorites').flush({ colors: [], patterns: [] });

    service.toggle(sage);
    http
      .expectOne('/api/v1/me/favorites/colors/c1')
      .flush({ message: 'nope' }, { status: 500, statusText: '' });
    expect(service.isFavorite('c1')).toBe(false);
  });

  it('sends guests to log in instead of calling the API', () => {
    setup(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    service.toggle(sage);
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], expect.anything());
    expect(service.isFavorite('c1')).toBe(false);
  });
});
