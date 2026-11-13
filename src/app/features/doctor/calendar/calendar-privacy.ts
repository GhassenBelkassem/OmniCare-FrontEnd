/** Pure helpers for « Mode discret »: initials instead of names, no name in accessible labels. */

const FALLBACK_LABEL = 'Patient';
const FIRST_LETTER = /[\p{L}\p{N}]/u;

/**
 * Full name, or initials such as « K. M. » when discreet. Initials are the first letters of the first
 * two words, upper-cased; any script is supported. Empty or missing names give « Patient ».
 */
export function patientLabel(displayName: string | null | undefined, discreet: boolean): string {
  const name = displayName?.trim().replace(/\s+/g, ' ') ?? '';
  if (name === '') return FALLBACK_LABEL;
  if (!discreet) return name;

  const initials = name
    .split(' ')
    .map(initialOf)
    .filter((initial): initial is string => initial !== null)
    .slice(0, 2);
  return initials.length === 0 ? FALLBACK_LABEL : initials.map((initial) => `${initial}.`).join(' ');
}

/**
 * French sentence for the accessible label of a calendar card. The patient name is left out when
 * discreet, so a screen reader never speaks what the screen hides.
 */
export function eventAriaLabel(
  time: string,
  displayName: string | null | undefined,
  stateLabel: string,
  discreet: boolean,
): string {
  const when = time.trim();
  const state = stateLabel.trim();
  const head = when === '' ? 'Rendez-vous' : `Rendez-vous à ${when}`;
  const withPatient = discreet ? head : `${head} avec ${patientLabel(displayName, false)}`;
  return state === '' ? `${withPatient}.` : `${withPatient}. Statut : ${state}.`;
}

function initialOf(word: string): string | null {
  const letter = FIRST_LETTER.exec(word)?.[0];
  return letter === undefined ? null : letter.toLocaleUpperCase('fr-FR');
}
