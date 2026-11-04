import { staticDemoRequestIsOffline } from './static-demo-api.interceptor';

describe('static demo API boundary', () => {
  it('recognizes relative and absolute OmniCare API URLs', () => {
    expect(staticDemoRequestIsOffline('/api/v1/appointments')).toBe(true);
    expect(
      staticDemoRequestIsOffline('http://localhost:8080/api/v1/doctor/scheduled-care?from=now'),
    ).toBe(true);
  });

  it('does not claim application assets or unrelated URLs', () => {
    expect(staticDemoRequestIsOffline('/assets/icon/app_icon.png')).toBe(false);
    expect(staticDemoRequestIsOffline('https://example.com/content')).toBe(false);
  });
});
