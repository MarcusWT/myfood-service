import { routeTitle } from './RouteAnnouncer';

describe('routeTitle', () => {
  it('normalises trailing slashes and sub-paths', () => {
    expect(routeTitle('/')).toBe('Dashboard');
    expect(routeTitle('/inventory/')).toBe('Inventory');
    expect(routeTitle('/inventory/123')).toBe('Inventory');
    expect(routeTitle('/shopping//')).toBe('Shopping');
  });

  it('keeps unknown paths as not found', () => {
    expect(routeTitle('/nope')).toBe('Page not found');
    expect(routeTitle('/inventoryx')).toBe('Page not found');
    expect(routeTitle('/login/extra')).toBe('Page not found');
  });
});
