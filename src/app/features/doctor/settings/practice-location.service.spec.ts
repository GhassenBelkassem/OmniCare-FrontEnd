import { describe, expect, it } from 'vitest';

import { PracticeLocationService } from './practice-location.service';

describe('PracticeLocationService', () => {
  let service: PracticeLocationService;
  const originalGeolocation = navigator.geolocation;

  function stubGeolocation(mode: 'success' | 'error' | 'absent'): void {
    if (mode === 'absent') {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
      return;
    }
    const geolocation = {
      getCurrentPosition: (
        success: (position: { coords: { latitude: number; longitude: number } }) => void,
        error?: (failure: { code: number; message: string }) => void,
      ) => {
        if (mode === 'success') {
          success({ coords: { latitude: 36.8065, longitude: 10.1815 } });
        } else {
          error?.({ code: 1, message: 'denied' });
        }
      },
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
  }

  beforeEach(() => {
    service = new PracticeLocationService();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  });

  it('resolves the current coordinates on success', async () => {
    stubGeolocation('success');
    await expect(service.getCurrentPosition()).resolves.toEqual({
      latitude: 36.8065,
      longitude: 10.1815,
    });
  });

  it('resolves null when the browser denies geolocation', async () => {
    stubGeolocation('error');
    await expect(service.getCurrentPosition()).resolves.toBeNull();
  });

  it('resolves null when geolocation is unavailable', async () => {
    stubGeolocation('absent');
    await expect(service.getCurrentPosition()).resolves.toBeNull();
  });
});
