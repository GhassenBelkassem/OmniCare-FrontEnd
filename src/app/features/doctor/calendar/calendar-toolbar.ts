import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSegmentedModule, type NzSegmentedOption } from 'ng-zorro-antd/segmented';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { OcButton } from '../../../shared/ui/button/oc-button';
import { dateValueToUiDate, uiDateToDateValue } from '../../../shared/ui/date-field/oc-date-field';
import { MIN_SEARCH_LENGTH } from './calendar-search';
import { CALENDAR_SHORTCUT_ROWS, NO_SHORTCUT_NOTE } from './calendar-shortcuts';
import type { CalendarViewAction, CalendarViewModel } from './calendar-view.models';

/**
 * Toolbar of the doctor calendar: view tabs, previous / next, the period as a date-picker button,
 * « Aujourd'hui », search, « Filtres », « Mode discret », « Nouveau rendez-vous » and the shortcuts window.
 *
 * It only emits actions and shows what the page gives it: search and filters work on the data already
 * loaded for the visible period, and a picked date is a calendar date (`YYYY-MM-DD`), never an instant.
 */
@Component({
  selector: 'app-calendar-toolbar',
  imports: [FormsModule, NzDatePickerModule, NzIconModule, NzSegmentedModule, NzTagModule, OcButton],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="cal-toolbar" role="toolbar" aria-label="Barre d’outils du calendrier">
      <nz-segmented
        class="cal-toolbar__views"
        aria-label="Mode d'affichage du calendrier"
        [nzOptions]="viewOptions"
        [ngModel]="model().viewMode"
        (ngModelChange)="action.emit({ kind: 'SET_VIEW', value: $any($event) })"
      />

      <div class="cal-toolbar__group" aria-label="Navigation du calendrier">
        <oc-button variant="secondary" size="small" leadingIcon="left" [iconOnly]="true" ariaLabel="Période précédente" (click)="action.emit({ kind: 'PREVIOUS' })" />
        <oc-button variant="secondary" size="small" leadingIcon="right" [iconOnly]="true" ariaLabel="Période suivante" (click)="action.emit({ kind: 'NEXT' })" />
      </div>

      <div class="cal-toolbar__anchor">
        <button
          type="button"
          class="cal-period"
          aria-label="Choisir une date"
          aria-haspopup="dialog"
          [attr.aria-expanded]="pickerOpen()"
          (click)="togglePicker()"
        >
          <span class="cal-period__label">{{ model().visibleTitle || 'Choisir une date' }}</span>
          <nz-icon nzType="down" aria-hidden="true" />
        </button>
        @if (pickerOpen()) {
          <div class="cal-popover cal-popover--picker" role="dialog" aria-label="Choisir une date">
            <nz-date-picker nzInline [ngModel]="pickerValue()" (ngModelChange)="pickDate($event)" />
          </div>
        }
      </div>

      <oc-button variant="secondary" size="small" (click)="action.emit({ kind: 'TODAY' })">Aujourd'hui</oc-button>
      @if (model().realtimeDeferred) {
        <nz-tag class="doctor-calendar-demo__sync-warning" nzColor="warning" role="status">
          Mise à jour en temps réel indisponible — actualisation automatique
        </nz-tag>
      }

      <span class="cal-toolbar__spacer"></span>

      <!-- CAL-FIX-2 fix 4: in the month the hint is the disabled field's placeholder and tooltip (no text under it).
           The tooltip sits on the wrapper too, because some browsers show none on a disabled field. -->
      <div class="cal-toolbar__anchor cal-search" [attr.title]="searchDisabled() ? monthSearchHint : null">
        <label class="cal-sr-only" for="cal-search-input">Rechercher dans l'agenda</label>
        <nz-icon class="cal-search__icon" nzType="search" aria-hidden="true" />
        <input
          #searchInput
          id="cal-search-input"
          class="cal-search__input"
          type="text"
          autocomplete="off"
          [placeholder]="searchDisabled() ? monthSearchHint : searchPlaceholder()"
          [attr.title]="searchDisabled() ? monthSearchHint : null"
          aria-describedby="cal-search-help"
          [disabled]="searchDisabled()"
          [value]="model().searchQuery ?? ''"
          (input)="onSearchInput($any($event.target).value)"
          (focus)="resultsOpen.set(true)"
          (keydown.enter)="chooseFirst($event)"
        />
        <kbd class="cal-kbd" aria-hidden="true">/</kbd>
        <span id="cal-search-help" class="cal-sr-only">{{ searchDisabled() ? monthSearchHint : 'Au moins ' + minSearch + ' caractères. La touche barre oblique place le curseur ici.' }}</span>
        @if (resultsOpen() && !searchDisabled() && model().search?.active) {
          <div class="cal-popover cal-popover--results" aria-label="Résultats de la recherche">
            @if (model().search?.results?.length) {
              <ul class="cal-results">
                @for (result of model().search?.results; track result.kind + result.id) {
                  <li>
                    <button type="button" class="cal-result" (click)="chooseResult(result.kind, result.id)">
                      <span class="cal-result__when">{{ result.dayLabel }} · {{ result.timeLabel }}</span>
                      <span class="cal-result__name">{{ result.name }}</span>
                      <span class="cal-chip" [class]="result.cssClass">{{ result.stateLabel }}</span>
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="cal-popover__empty" role="status">Aucun résultat dans cette période</p>
            }
          </div>
        }
      </div>

      <div class="cal-toolbar__anchor">
        <button
          type="button"
          class="cal-button"
          aria-haspopup="true"
          [attr.aria-expanded]="filtersOpen()"
          (click)="toggleFilters()"
        >
          <nz-icon nzType="filter" aria-hidden="true" />
          <span>Filtres</span>
          @if ((model().hiddenFilterCount ?? 0) > 0) {
            <span class="cal-badge" [attr.aria-label]="model().hiddenFilterCount + ' filtre(s) actif(s)'">{{ model().hiddenFilterCount }}</span>
          }
        </button>
        @if (filtersOpen()) {
          <div class="cal-popover cal-popover--filters" role="group" aria-label="Filtres">
            <p class="cal-popover__title">Afficher dans l'agenda</p>
            @for (option of model().filters; track option.state) {
              <label class="cal-check">
                <input type="checkbox" [checked]="option.visible" (change)="action.emit({ kind: 'TOGGLE_FILTER', state: option.state })" />
                <span>{{ option.label }}</span>
              </label>
            }
            <oc-button variant="quiet" size="small" [disabled]="(model().hiddenFilterCount ?? 0) === 0" (click)="action.emit({ kind: 'RESET_FILTERS' })">
              Réinitialiser
            </oc-button>
          </div>
        }
      </div>

      <button
        type="button"
        role="switch"
        class="cal-switch"
        [attr.aria-checked]="model().discreet === true"
        (click)="toggleDiscreet($event)"
      >
        <span class="cal-switch__track" aria-hidden="true"><span class="cal-switch__thumb"></span></span>
        <span>Mode discret</span>
      </button>

      @if (model().quickBookingEnabled) {
        <oc-button variant="primary" size="small" leadingIcon="plus" (click)="action.emit({ kind: 'NEW_APPOINTMENT' })">
          Nouveau rendez-vous <kbd class="cal-kbd cal-kbd--on-primary" aria-hidden="true">N</kbd>
        </oc-button>
      }

      <oc-button #shortcutsButton variant="quiet" size="small" (click)="openShortcuts($event.target)">Raccourcis clavier</oc-button>
    </div>

    @if (shortcutsOpen()) {
      <div class="cal-dialog-backdrop" (click)="closeShortcuts()"></div>
      <div
        #dialog
        class="cal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-shortcuts-title"
        tabindex="-1"
        (keydown)="trapFocus($event)"
        (keydown.escape)="onDialogEscape($event)"
      >
        <h2 id="cal-shortcuts-title" class="cal-dialog__title">Raccourcis clavier</h2>
        <dl class="cal-shortcuts">
          @for (row of rows; track row.label) {
            <div class="cal-shortcuts__row">
              <dt>
                @for (key of row.keys; track key) {<kbd class="cal-kbd">{{ key }}</kbd>}
              </dt>
              <dd>{{ row.label }}</dd>
            </div>
          }
        </dl>
        <p class="cal-dialog__note">{{ note }}</p>
        <button
          type="button"
          role="switch"
          class="cal-switch cal-dialog__switch"
          [attr.aria-checked]="model().shortcutsEnabled !== false"
          (click)="action.emit({ kind: 'TOGGLE_SHORTCUTS' })"
        >
          <span class="cal-switch__track" aria-hidden="true"><span class="cal-switch__thumb"></span></span>
          <span>Raccourcis clavier activés</span>
        </button>
        <div class="cal-dialog__actions">
          <oc-button variant="secondary" size="small" (click)="closeShortcuts()">Fermer</oc-button>
        </div>
      </div>
    }
  `,
  styleUrl: './calendar-toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarToolbar {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  readonly model = input.required<CalendarViewModel>();
  readonly action = output<CalendarViewAction>();

  readonly viewOptions: NzSegmentedOption[] = [
    { value: 'day', label: 'Jour' },
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' },
  ];
  // Read when rendered, not copied when the toolbar is created: see « Test bundler quirk » in
  // docs/reports/G3/G3-CAL-FIX-final.md (fix 13).
  get rows(): typeof CALENDAR_SHORTCUT_ROWS {
    return CALENDAR_SHORTCUT_ROWS;
  }
  get note(): string {
    return NO_SHORTCUT_NOTE;
  }
  get minSearch(): number {
    return MIN_SEARCH_LENGTH;
  }

  /** Search looks through the cards of the Jour and Semaine grids; the month shows counts only. */
  readonly searchDisabled = computed(() => this.model().viewMode === 'month');
  readonly monthSearchHint = 'La recherche fonctionne en vue Jour et Semaine';
  searchPlaceholder(): string {
    return "Rechercher dans l'agenda…";
  }

  readonly pickerOpen = signal(false);
  readonly filtersOpen = signal(false);
  readonly resultsOpen = signal(false);
  readonly shortcutsOpen = signal(false);
  private opener: HTMLElement | null = null;

  /** The picker opens on the first day of the visible period. */
  readonly pickerValue = computed(() => dateValueToUiDate(this.model().currentDate));

  constructor() {
    // Focus goes into the shortcuts window when it opens.
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (dialog !== undefined) queueMicrotask(() => this.focusableIn(dialog)[0]?.focus() ?? dialog.focus());
    });
  }

  // ---- picker ----

  togglePicker(): void {
    this.filtersOpen.set(false);
    this.resultsOpen.set(false);
    this.pickerOpen.update((open) => !open);
  }

  openPicker(): void {
    this.filtersOpen.set(false);
    this.resultsOpen.set(false);
    this.pickerOpen.set(true);
  }

  /** The picker gives a local `Date` for the picked square; only its year-month-day is used. */
  pickDate(value: Date | null): void {
    const date = uiDateToDateValue(value);
    if (date === null) return;
    this.pickerOpen.set(false);
    this.action.emit({ kind: 'GO_TO_DATE', date });
  }

  // ---- search ----

  focusSearch(): void {
    if (this.searchDisabled()) return;
    this.pickerOpen.set(false);
    this.filtersOpen.set(false);
    this.searchInput()?.nativeElement.focus();
    this.resultsOpen.set(true);
  }

  onSearchInput(query: string): void {
    this.resultsOpen.set(true);
    this.action.emit({ kind: 'SET_SEARCH', query });
  }

  chooseResult(resource: 'appointment' | 'request', id: string): void {
    this.resultsOpen.set(false);
    this.action.emit({ kind: 'OPEN_ITEM', resource, id });
  }

  chooseFirst(event: Event): void {
    const first = this.model().search?.results[0];
    if (first === undefined) return;
    event.preventDefault();
    this.chooseResult(first.kind, first.id);
  }

  // ---- filters ----

  toggleFilters(): void {
    this.pickerOpen.set(false);
    this.resultsOpen.set(false);
    this.filtersOpen.update((open) => !open);
  }

  // ---- shortcuts window ----

  /** Opens the window and remembers who opened it, to give the focus back on close. */
  /**
   * Fix 8: after a mouse or touch click the switch gives the focus back, so a later key press (shortcuts,
   * arrows) does not draw the keyboard ring on it. A keyboard press (Espace / Entrée, `detail === 0`)
   * keeps the focus where it is.
   */
  toggleDiscreet(event: MouseEvent): void {
    this.action.emit({ kind: 'TOGGLE_DISCREET' });
    if (event.detail > 0) (event.currentTarget as HTMLElement | null)?.blur();
  }

  openShortcuts(opener?: EventTarget | null): void {
    const candidate = (opener ?? this.document.activeElement) as HTMLElement | null;
    this.opener = candidate?.closest?.('button') ?? candidate;
    this.pickerOpen.set(false);
    this.filtersOpen.set(false);
    this.resultsOpen.set(false);
    this.shortcutsOpen.set(true);
  }

  closeShortcuts(): void {
    if (!this.shortcutsOpen()) return;
    this.shortcutsOpen.set(false);
    const opener = this.opener;
    this.opener = null;
    if (opener !== null && this.document.contains(opener)) opener.focus();
  }

  onDialogEscape(event: Event): void {
    event.stopPropagation();
    this.closeShortcuts();
  }

  /** Keeps Tab inside the window. */
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const dialog = this.dialog()?.nativeElement;
    if (dialog === undefined) return;
    const focusable = this.focusableIn(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ---- used by the page ----

  /** True while a window or a popover is open: single-key shortcuts must not fire. */
  blocksShortcuts(): boolean {
    return this.shortcutsOpen() || this.pickerOpen() || this.filtersOpen();
  }

  /**
   * Échap: closes the shortcuts window, then the popovers, then clears the search. Returns whether
   * anything was closed or cleared.
   */
  closeTransient(): boolean {
    if (this.shortcutsOpen()) {
      this.closeShortcuts();
      return true;
    }
    if (this.pickerOpen() || this.filtersOpen()) {
      this.pickerOpen.set(false);
      this.filtersOpen.set(false);
      return true;
    }
    if (this.resultsOpen() || (this.model().searchQuery ?? '') !== '') {
      const hadQuery = (this.model().searchQuery ?? '') !== '';
      this.resultsOpen.set(false);
      if (hadQuery) this.action.emit({ kind: 'SET_SEARCH', query: '' });
      this.searchInput()?.nativeElement.blur();
      return true;
    }
    return false;
  }

  onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (target !== null && this.host.nativeElement.contains(target)) {
      const inside = (target as HTMLElement).closest?.('.cal-toolbar__anchor');
      // A click on another part of the toolbar closes the popovers that do not belong to it.
      if (inside === null || inside === undefined) this.closePopovers();
      return;
    }
    this.closePopovers();
  }

  private closePopovers(): void {
    this.pickerOpen.set(false);
    this.filtersOpen.set(false);
    this.resultsOpen.set(false);
  }

  private focusableIn(root: HTMLElement): HTMLElement[] {
    return [
      ...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ].filter((element) => !element.hasAttribute('disabled'));
  }
}
