import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { FavouriteService } from '../../services/favourite.service';
import { FavouritesComponent } from './favourites.component';

describe('starred messages retrieval contract', () => {
  it('keeps the authenticated favourites persistence and paged retrieval boundary', () => {
    expect(typeof FavouriteService.prototype.addFavourite).toBe('function');
    expect(typeof FavouriteService.prototype.getStarredMessages).toBe('function');
    expect(typeof FavouriteService.prototype.removeFavourite).toBe('function');
  });

  it('keeps a dedicated favourites retrieval route', () => {
    const favouritesRoute = routes.find((route) => route.path === 'favourites');

    expect(favouritesRoute).toBeDefined();
    expect(favouritesRoute?.loadComponent).toBeTypeOf('function');
  });

  it('keeps starred text messages as a first-class retrieval filter', () => {
    const componentPrototype = FavouritesComponent.prototype as unknown as Record<
      string,
      unknown
    >;

    expect(typeof componentPrototype['setTab']).toBe('function');
    expect(typeof componentPrototype['loadFavourites']).toBe('function');
    expect(typeof componentPrototype['deleteFavourite']).toBe('function');
  });
});
