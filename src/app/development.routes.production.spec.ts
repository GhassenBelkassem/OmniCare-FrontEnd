import { DEVELOPMENT_ROOT_ROUTES, DEVELOPMENT_SHELL_ROUTES } from './development.routes.production';

describe('optimized development route replacement', () => {
  it('keeps development-only route graphs out of optimized builds', () => {
    expect(DEVELOPMENT_ROOT_ROUTES).toEqual([]);
    expect(DEVELOPMENT_SHELL_ROUTES).toEqual([]);
  });
});
