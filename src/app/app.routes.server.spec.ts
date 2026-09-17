import { RenderMode } from '@angular/ssr';

import { serverRoutes } from './app.routes.server';

describe('server routes', () => {
  it('never prerenders user-specific or anonymous authentication states', () => {
    expect(serverRoutes.every((route) => route.renderMode === RenderMode.Client)).toBe(true);
    expect(serverRoutes.find((route) => route.path === 'clinic/**')?.renderMode).toBe(RenderMode.Client);
    expect(serverRoutes.find((route) => route.path === 'login')?.renderMode).toBe(RenderMode.Client);
  });
});
