import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UrgentAcceptedStore } from './urgent-accepted.store';

describe('UrgentAcceptedStore legacy containment', () => {
  afterEach(() => {
    localStorage.removeItem('omnicare_accepted_offers');
    localStorage.removeItem('omnicare_unrelated');
    TestBed.resetTestingModule();
  });

  it('removes only the verified legacy urgent key in a browser', () => {
    localStorage.setItem('omnicare_accepted_offers', '{"patientName":"Legacy"}');
    localStorage.setItem('omnicare_unrelated', 'preserved');

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    TestBed.inject(UrgentAcceptedStore).purgeLegacyCache();

    expect(localStorage.getItem('omnicare_accepted_offers')).toBeNull();
    expect(localStorage.getItem('omnicare_unrelated')).toBe('preserved');
  });

  it('does not access browser storage during SSR', () => {
    const storage = globalThis.localStorage;
    const getItem = vi.spyOn(storage, 'getItem');
    const removeItem = vi.spyOn(storage, 'removeItem');
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    expect(() => TestBed.inject(UrgentAcceptedStore).purgeLegacyCache()).not.toThrow();
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
