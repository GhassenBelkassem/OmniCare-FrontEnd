/**
 * Keyboard shortcuts of the doctor calendar (canvas « Agenda médecin » v3.3).
 *
 * None of them triggers a patient-impacting action: Accepter, Refuser, Annuler, Démarrer, Déplacer and
 * Marquer absent have no shortcut and always go through their confirmation. « Flèches » and « Espace »
 * as month-view shortcuts are not part of this map (a later step).
 */
export type CalendarShortcutAction =
  | 'TODAY'
  | 'VIEW_DAY'
  | 'VIEW_WEEK'
  | 'VIEW_MONTH'
  | 'PREVIOUS'
  | 'NEXT'
  | 'NEW_APPOINTMENT'
  | 'FOCUS_SEARCH'
  | 'OPEN_PICKER'
  | 'TOGGLE_DISCREET'
  | 'SHOW_SHORTCUTS'
  | 'OPEN_SELECTED';

/** Every action a shortcut may trigger: navigation, display and opening things only. */
export const SAFE_SHORTCUT_ACTIONS: readonly CalendarShortcutAction[] = [
  'TODAY',
  'VIEW_DAY',
  'VIEW_WEEK',
  'VIEW_MONTH',
  'PREVIOUS',
  'NEXT',
  'NEW_APPOINTMENT',
  'FOCUS_SEARCH',
  'OPEN_PICKER',
  'TOGGLE_DISCREET',
  'SHOW_SHORTCUTS',
  'OPEN_SELECTED',
];

export interface CalendarShortcutRow {
  /** Keys as written on the keyboard, one `<kbd>` each. */
  readonly keys: readonly string[];
  readonly label: string;
}

/** The list shown in the shortcuts window, in the order of the canvas. */
export const CALENDAR_SHORTCUT_ROWS: readonly CalendarShortcutRow[] = [
  { keys: ['T'], label: 'Aujourd’hui' },
  { keys: ['J'], label: 'Vue Jour' },
  { keys: ['S'], label: 'Vue Semaine' },
  { keys: ['M'], label: 'Vue Mois' },
  { keys: ['←', '→'], label: 'Période précédente / suivante' },
  { keys: ['N'], label: 'Nouveau rendez-vous' },
  { keys: ['/'], label: 'Rechercher' },
  { keys: ['G'], label: 'Aller à une date' },
  { keys: ['D'], label: 'Mode discret' },
  { keys: ['Échap'], label: 'Fermer l’aperçu ou le panneau' },
  { keys: ['?'], label: 'Afficher les raccourcis' },
  { keys: ['Entrée'], label: 'Ouvrir le rendez-vous sélectionné' },
];

export const NO_SHORTCUT_NOTE =
  'Annuler, déplacer ou marquer absent n’ont pas de raccourci : ces actions passent toujours par une confirmation.';

export interface ShortcutKeyEvent {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

/**
 * The action of a key press, or `null`. Presses with Ctrl, Meta or Alt are never shortcuts (they belong to
 * the browser and the system). Shift is allowed: « ? » needs it on many keyboards.
 */
export function resolveShortcut(event: ShortcutKeyEvent): CalendarShortcutAction | null {
  if (event.ctrlKey === true || event.metaKey === true || event.altKey === true) return null;
  switch (event.key) {
    case 't':
    case 'T':
      return 'TODAY';
    case 'j':
    case 'J':
      return 'VIEW_DAY';
    case 's':
    case 'S':
      return 'VIEW_WEEK';
    case 'm':
    case 'M':
      return 'VIEW_MONTH';
    case 'ArrowLeft':
      return 'PREVIOUS';
    case 'ArrowRight':
      return 'NEXT';
    case 'n':
    case 'N':
      return 'NEW_APPOINTMENT';
    case '/':
      return 'FOCUS_SEARCH';
    case 'g':
    case 'G':
      return 'OPEN_PICKER';
    case 'd':
    case 'D':
      return 'TOGGLE_DISCREET';
    case '?':
      return 'SHOW_SHORTCUTS';
    case 'Enter':
      return 'OPEN_SELECTED';
    default:
      return null;
  }
}

/** True when the key press goes to a field where the doctor is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element === null || typeof element.tagName !== 'string') return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return element.isContentEditable === true || element.getAttribute?.('contenteditable') === 'true';
}

/** True for controls where Enter / a letter already has its own meaning (buttons, links, switches). */
export function isActivatableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element === null || typeof element.tagName !== 'string') return false;
  const tag = element.tagName.toLowerCase();
  return tag === 'button' || tag === 'a' || tag === 'summary' || element.getAttribute?.('role') === 'switch';
}
