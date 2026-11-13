import { Injectable, signal } from '@angular/core';

export const CALENDAR_DISCREET_STORAGE_KEY = 'oc.calendar.discreet';
export const CALENDAR_SHORTCUTS_STORAGE_KEY = 'oc.calendar.shortcuts';

/**
 * Calendar display preferences, kept per browser (CTO decision a, CAL-FIX fix 9): « Mode discret » and
 * the single-key shortcuts both SURVIVE logout. Only two booleans are stored, never a name or any
 * patient data, so neither is registered with the SensitiveStateRegistry. Storage can be unavailable
 * (private mode, blocked site data, SSR), so every access is guarded; the defaults are « off » for
 * Mode discret and « on » for the shortcuts.
 */
@Injectable({ providedIn: 'root' })
export class CalendarPreferencesStore {
  private readonly _discreet = signal(readStoredDiscreet());
  readonly discreet = this._discreet.asReadonly();
  /**
   * Single-key shortcuts on or off (WCAG 2.1 SC 2.1.4). On by default; only an explicit « off » is stored.
   */
  private readonly _shortcutsEnabled = signal(readStoredShortcutsEnabled());
  readonly shortcutsEnabled = this._shortcutsEnabled.asReadonly();

  toggle(): void {
    const next = !this._discreet();
    this._discreet.set(next);
    writeStoredDiscreet(next);
  }

  toggleShortcuts(): void {
    const next = !this._shortcutsEnabled();
    this._shortcutsEnabled.set(next);
    writeStoredShortcutsEnabled(next);
  }
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredDiscreet(): boolean {
  try {
    return storage()?.getItem(CALENDAR_DISCREET_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredDiscreet(value: boolean): void {
  try {
    storage()?.setItem(CALENDAR_DISCREET_STORAGE_KEY, String(value));
  } catch {
    // Preference stays in memory for this session.
  }
}

function readStoredShortcutsEnabled(): boolean {
  try {
    return storage()?.getItem(CALENDAR_SHORTCUTS_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeStoredShortcutsEnabled(value: boolean): void {
  try {
    storage()?.setItem(CALENDAR_SHORTCUTS_STORAGE_KEY, String(value));
  } catch {
    // The choice stays in memory for this session.
  }
}
