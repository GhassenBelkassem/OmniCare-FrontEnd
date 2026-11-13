import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SensitiveStateRegistry } from '../../../core/auth/sensitive-state.registry';
import {
  CALENDAR_DISCREET_STORAGE_KEY,
  CALENDAR_SHORTCUTS_STORAGE_KEY,
  CalendarPreferencesStore,
} from './calendar-preferences.store';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

function blockedStorage(): Storage {
  const fail = (): never => {
    throw new Error('storage blocked');
  };
  return {
    get length(): number {
      return fail();
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}

function createStore(): CalendarPreferencesStore {
  TestBed.resetTestingModule();
  return TestBed.inject(CalendarPreferencesStore);
}

describe('CalendarPreferencesStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to off when nothing is stored', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(createStore().discreet()).toBe(false);
  });

  it('restores a stored « true »', () => {
    vi.stubGlobal('localStorage', memoryStorage({ [CALENDAR_DISCREET_STORAGE_KEY]: 'true' }));
    expect(createStore().discreet()).toBe(true);
  });

  it('treats any stored value other than « true » as off', () => {
    for (const value of ['false', '1', 'yes', '', '{"a":1}']) {
      vi.stubGlobal('localStorage', memoryStorage({ [CALENDAR_DISCREET_STORAGE_KEY]: value }));
      expect(createStore().discreet()).toBe(false);
    }
  });

  it('toggles and persists only the boolean under the agreed key', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createStore();

    store.toggle();
    expect(store.discreet()).toBe(true);
    expect(storage.getItem('oc.calendar.discreet')).toBe('true');
    expect(storage.length).toBe(1);

    store.toggle();
    expect(store.discreet()).toBe(false);
    expect(storage.getItem('oc.calendar.discreet')).toBe('false');
  });

  it('survives a new store instance (reload) with the persisted value', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    createStore().toggle();
    expect(createStore().discreet()).toBe(true);
  });

  it('keeps working in memory when storage throws on every access', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    const store = createStore();
    expect(store.discreet()).toBe(false);
    expect(() => store.toggle()).not.toThrow();
    expect(store.discreet()).toBe(true);
  });

  it('keeps working when localStorage itself is undefined', () => {
    vi.stubGlobal('localStorage', undefined);
    const store = createStore();
    expect(store.discreet()).toBe(false);
    store.toggle();
    expect(store.discreet()).toBe(true);
  });

  it('SURVIVES logout: the sensitive-state cleanup keeps the value and the stored key (fix 9)', () => {
    const storage = memoryStorage({ [CALENDAR_DISCREET_STORAGE_KEY]: 'true' });
    vi.stubGlobal('localStorage', storage);
    const store = createStore();
    expect(store.discreet()).toBe(true);

    TestBed.inject(SensitiveStateRegistry).clearAll();

    expect(store.discreet()).toBe(true);
    expect(storage.getItem(CALENDAR_DISCREET_STORAGE_KEY)).toBe('true');
    // The next session (a new store, as after a reload) starts in Mode discret.
    expect(createStore().discreet()).toBe(true);
  });

  it('keeps Mode discret through logout when storage is blocked (memory only)', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    const store = createStore();
    store.toggle();
    expect(() => TestBed.inject(SensitiveStateRegistry).clearAll()).not.toThrow();
    expect(store.discreet()).toBe(true);
  });
});

describe('CalendarPreferencesStore keyboard shortcuts', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('are on by default', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(createStore().shortcutsEnabled()).toBe(true);
  });

  it('are restored as off only from an explicit « false »', () => {
    vi.stubGlobal('localStorage', memoryStorage({ [CALENDAR_SHORTCUTS_STORAGE_KEY]: 'false' }));
    expect(createStore().shortcutsEnabled()).toBe(false);

    for (const value of ['true', '', '0', 'no', '{"a":1}']) {
      vi.stubGlobal('localStorage', memoryStorage({ [CALENDAR_SHORTCUTS_STORAGE_KEY]: value }));
      expect(createStore().shortcutsEnabled()).toBe(true);
    }
  });

  it('toggle and persist only the boolean under their own key', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createStore();

    store.toggleShortcuts();
    expect(store.shortcutsEnabled()).toBe(false);
    expect(storage.getItem('oc.calendar.shortcuts')).toBe('false');
    expect(storage.getItem(CALENDAR_DISCREET_STORAGE_KEY)).toBeNull();

    store.toggleShortcuts();
    expect(store.shortcutsEnabled()).toBe(true);
    expect(storage.getItem('oc.calendar.shortcuts')).toBe('true');
  });

  it('survive a reload', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    createStore().toggleShortcuts();

    expect(createStore().shortcutsEnabled()).toBe(false);
  });

  it('keep working in memory when storage is blocked', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    const store = createStore();

    expect(store.shortcutsEnabled()).toBe(true);
    expect(() => store.toggleShortcuts()).not.toThrow();
    expect(store.shortcutsEnabled()).toBe(false);
  });

  it('are not cleared at logout, and neither is Mode discret (CTO decision a)', () => {
    const storage = memoryStorage({
      [CALENDAR_SHORTCUTS_STORAGE_KEY]: 'false',
      [CALENDAR_DISCREET_STORAGE_KEY]: 'true',
    });
    vi.stubGlobal('localStorage', storage);
    const store = createStore();

    TestBed.inject(SensitiveStateRegistry).clearAll();

    expect(store.discreet()).toBe(true);
    expect(store.shortcutsEnabled()).toBe(false);
    expect(storage.getItem(CALENDAR_DISCREET_STORAGE_KEY)).toBe('true');
    expect(storage.getItem(CALENDAR_SHORTCUTS_STORAGE_KEY)).toBe('false');
  });
});
