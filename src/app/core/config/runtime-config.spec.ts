import { readRuntimeConfig } from './runtime-config';

describe('readRuntimeConfig', () => {
  it('uses the same-origin API when runtime configuration is absent', () => {
    expect(readRuntimeConfig({} as typeof globalThis)).toEqual({ apiBaseUrl: '/api/v1' });
  });

  it('accepts and normalizes an absolute HTTP API URL', () => {
    const source = {
      __OMNICARE_CONFIG__: { apiBaseUrl: ' https://api.omnicare.tn/api/v1/ ' },
    } as unknown as typeof globalThis;

    expect(readRuntimeConfig(source)).toEqual({
      apiBaseUrl: 'https://api.omnicare.tn/api/v1',
    });
  });

  it('rejects unsupported schemes', () => {
    const source = {
      __OMNICARE_CONFIG__: { apiBaseUrl: 'javascript:alert(1)' },
    } as unknown as typeof globalThis;

    expect(readRuntimeConfig(source)).toEqual({ apiBaseUrl: '/api/v1' });
  });
});
