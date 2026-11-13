import { describe, expect, it } from 'vitest';

import {
  CALENDAR_SHORTCUT_ROWS,
  NO_SHORTCUT_NOTE,
  SAFE_SHORTCUT_ACTIONS,
  isActivatableTarget,
  isTypingTarget,
  resolveShortcut,
  type CalendarShortcutAction,
} from './calendar-shortcuts';

describe('resolveShortcut', () => {
  const map: ReadonlyArray<readonly [string, CalendarShortcutAction]> = [
    ['t', 'TODAY'],
    ['T', 'TODAY'],
    ['j', 'VIEW_DAY'],
    ['J', 'VIEW_DAY'],
    ['s', 'VIEW_WEEK'],
    ['S', 'VIEW_WEEK'],
    ['m', 'VIEW_MONTH'],
    ['M', 'VIEW_MONTH'],
    ['ArrowLeft', 'PREVIOUS'],
    ['ArrowRight', 'NEXT'],
    ['n', 'NEW_APPOINTMENT'],
    ['N', 'NEW_APPOINTMENT'],
    ['/', 'FOCUS_SEARCH'],
    ['g', 'OPEN_PICKER'],
    ['G', 'OPEN_PICKER'],
    ['d', 'TOGGLE_DISCREET'],
    ['D', 'TOGGLE_DISCREET'],
    ['?', 'SHOW_SHORTCUTS'],
    ['Enter', 'OPEN_SELECTED'],
  ];

  for (const [key, action] of map) {
    it(`maps « ${key} » to ${action}`, () => {
      expect(resolveShortcut({ key })).toBe(action);
    });
  }

  it('ignores presses with Ctrl, Meta or Alt (they belong to the browser and the system)', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      for (const [key] of map) {
        expect(resolveShortcut({ key, [modifier]: true })).toBeNull();
      }
    }
  });

  it('keeps « ? » working with Shift, which many keyboards need for it', () => {
    expect(resolveShortcut({ key: '?', ctrlKey: false, metaKey: false, altKey: false })).toBe('SHOW_SHORTCUTS');
  });

  it('has no shortcut for the month-view keys of the next step (arrows up/down, space)', () => {
    for (const key of ['ArrowUp', 'ArrowDown', ' ', 'Space', 'Escape', 'Tab', 'a', 'x']) {
      expect(resolveShortcut({ key })).toBeNull();
    }
  });

  it('has no shortcut for any action that touches a patient', () => {
    const patientImpacting = [
      'Accepter', 'Refuser', 'Annuler', 'Démarrer', 'Déplacer', 'Marquer absent',
      'ACCEPT', 'DECLINE', 'REFUSE', 'CANCEL', 'START', 'MOVE', 'RESCHEDULE', 'ABSENT', 'NO_SHOW', 'DELETE', 'CONFIRM', 'SEND',
    ];
    // Try every key of the keyboard that the browser reports with `key`.
    const keys = [
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/?.,;:!-=+*'.split(''),
      'Enter', 'Delete', 'Backspace', 'Escape', 'Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    ];
    const produced = new Set(keys.map((key) => resolveShortcut({ key })).filter((action) => action !== null));

    for (const action of produced) {
      expect(SAFE_SHORTCUT_ACTIONS).toContain(action);
      for (const word of patientImpacting) expect(action).not.toContain(word);
    }
    for (const row of CALENDAR_SHORTCUT_ROWS) {
      for (const word of patientImpacting.slice(0, 6)) expect(row.label).not.toContain(word);
    }
  });
});

describe('the shortcuts list', () => {
  it('follows the canvas, in French', () => {
    expect(CALENDAR_SHORTCUT_ROWS.map((row) => `${row.keys.join(' ')} ${row.label}`)).toEqual([
      'T Aujourd’hui',
      'J Vue Jour',
      'S Vue Semaine',
      'M Vue Mois',
      '← → Période précédente / suivante',
      'N Nouveau rendez-vous',
      '/ Rechercher',
      'G Aller à une date',
      'D Mode discret',
      'Échap Fermer l’aperçu ou le panneau',
      '? Afficher les raccourcis',
      'Entrée Ouvrir le rendez-vous sélectionné',
    ]);
  });

  it('carries the canvas note about actions that have no shortcut', () => {
    expect(NO_SHORTCUT_NOTE).toBe(
      'Annuler, déplacer ou marquer absent n’ont pas de raccourci : ces actions passent toujours par une confirmation.',
    );
  });
});

describe('typing and activatable targets', () => {
  const el = (html: string): HTMLElement => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild as HTMLElement;
  };

  it('recognises fields where the doctor is typing', () => {
    expect(isTypingTarget(el('<input />'))).toBe(true);
    expect(isTypingTarget(el('<textarea></textarea>'))).toBe(true);
    expect(isTypingTarget(el('<select></select>'))).toBe(true);
    expect(isTypingTarget(el('<div contenteditable="true"></div>'))).toBe(true);
  });

  it('does not treat other elements as typing', () => {
    expect(isTypingTarget(el('<div></div>'))).toBe(false);
    expect(isTypingTarget(el('<button></button>'))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('recognises controls where Entrée already has a meaning', () => {
    expect(isActivatableTarget(el('<button></button>'))).toBe(true);
    expect(isActivatableTarget(el('<a href="#">x</a>'))).toBe(true);
    expect(isActivatableTarget(el('<div role="switch"></div>'))).toBe(true);
    expect(isActivatableTarget(el('<div tabindex="0"></div>'))).toBe(false);
    expect(isActivatableTarget(null)).toBe(false);
  });
});
