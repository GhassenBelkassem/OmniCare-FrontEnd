import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Sessions only exist in browser sessionStorage. Rendering any of these paths
  // during a build would necessarily produce anonymous, potentially wrong HTML.
  { path: '', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'first-login', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'platform-admin', renderMode: RenderMode.Client },
  { path: 'doctor/**', renderMode: RenderMode.Client },
  { path: 'clinic/**', renderMode: RenderMode.Client },
  { path: 'forbidden', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
