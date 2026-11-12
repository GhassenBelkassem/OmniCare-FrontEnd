import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';

import type { MedicationDecision } from '../../prescription.models';
import { ConsultationSessionStore } from '../consultation-session.store';
import { ConsultationSectionDirective } from '../consultation-section.directive';
import { ConsultationUi, DISCARD_MESSAGE } from '../consultation-ui';
import {
  NOTE_PATHS,
  duplicateMedicationIndexes,
  medicationPath,
  type MedicationLineForm,
} from '../model/consultation-form';
import {
  DOSE_UNITS,
  DOSE_UNIT_LABELS,
  DURATION_UNITS,
  DURATION_UNIT_LABELS,
  ROUTES,
  ROUTE_LABELS,
  TEXT_LIMITS,
  type AdministrationRoute,
  type DoseUnit,
  type DurationUnit,
} from '../model/consultation-rules';

const DECISIONS = [
  { label: 'Aucun médicament', value: 'NO_MEDICATION' },
  { label: 'Prescrire', value: 'MEDICATION_PRESCRIBED' },
];

/** Section 4: treatment decision and, when « Prescrire », the prescription lines. */
@Component({
  selector: 'app-treatment-section',
  imports: [ConsultationSectionDirective, FormsModule, NzButtonModule, NzCheckboxModule, NzIconModule, NzInputModule, NzSegmentedModule, NzSelectModule],
  template: `
    <section class="c-card" appConsultationSection="traitement" aria-labelledby="treatment-title">
      <header class="c-card__header">
        <div class="c-card__title">
          <span class="c-card__number" aria-hidden="true">{{ number() }}</span>
          <h2 id="treatment-title">Traitement <span class="c-card__required" aria-hidden="true">*</span></h2>
        </div>
      </header>
      <div class="c-card__body">
        <div class="c-field" id="consultation-traitement" [attr.data-invalid]="decisionError() ? 'true' : null">
          <span class="c-field__label" id="treatment-decision-label">Décision de traitement</span>
          <nz-segmented
            [nzOptions]="decisions"
            [ngModel]="choice()"
            (ngModelChange)="choose($event)"
            [nzDisabled]="signed()"
            aria-labelledby="treatment-decision-label"
          />
          @if (decisionError(); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
        </div>

        @if (session.note().medicationDecision === 'MEDICATION_PRESCRIBED') {
          @if (signed()) {
            <p class="c-helper">L’ordonnance est signée : elle ne peut plus être modifiée.</p>
          }
          @for (line of session.lines(); track line.itemId; let index = $index) {
            <fieldset class="c-subcard c-line" [disabled]="signed()">
              <legend class="c-subcard__header">
                <strong>Médicament {{ index + 1 }}</strong>
              </legend>
              @if (!signed()) {
                <button
                  nz-button
                  nzType="text"
                  type="button"
                  class="c-line__remove"
                  [attr.aria-label]="'Retirer le médicament ' + (index + 1)"
                  (click)="remove(index)"
                >
                  <nz-icon nzType="delete" aria-hidden="true" /> Retirer
                </button>
              }
              <div class="c-field">
                <label class="c-field__label" [for]="id(index, 'name')">Médicament *</label>
                <input
                  nz-input
                  [id]="id(index, 'name')"
                  [value]="line.name"
                  [attr.maxlength]="limits.medicationName"
                  [attr.aria-invalid]="err(index, 'name') ? 'true' : null"
                  (input)="patch(index, { name: text($event) })"
                />
                <p class="c-field__hint">Saisie libre · hors catalogue</p>
                @if (err(index, 'name'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                @if (duplicates().has(index)) { <p class="c-field__warning">Ce médicament figure déjà sur l’ordonnance.</p> }
              </div>
              <div class="c-grid">
                <div class="c-field">
                  <label class="c-field__label" [for]="id(index, 'dose')">Dose *</label>
                  <input
                    nz-input
                    inputmode="decimal"
                    [id]="id(index, 'dose')"
                    [value]="line.dose"
                    [attr.aria-invalid]="err(index, 'dose.amount') ? 'true' : null"
                    (input)="patch(index, { dose: text($event) })"
                  />
                  @if (err(index, 'dose.amount'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
                <div class="c-field">
                  <label class="c-field__label" [for]="id(index, 'unit')">Unité *</label>
                  <nz-select
                    [nzId]="id(index, 'unit')"
                    nzPlaceHolder="Choisir"
                    [ngModel]="line.unit"
                    [attr.aria-invalid]="err(index, 'dose.unit') ? 'true' : null"
                    (ngModelChange)="patch(index, { unit: $event })"
                  >
                    @for (unit of units; track unit) { <nz-option [nzValue]="unit" [nzLabel]="unitLabels[unit]" /> }
                  </nz-select>
                  @if (err(index, 'dose.unit'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
                <div class="c-field">
                  <label class="c-field__label" [for]="id(index, 'route')">Voie *</label>
                  <nz-select
                    [nzId]="id(index, 'route')"
                    nzPlaceHolder="Choisir"
                    [ngModel]="line.route"
                    [attr.aria-invalid]="err(index, 'route') ? 'true' : null"
                    (ngModelChange)="patch(index, { route: $event })"
                  >
                    @for (route of routes; track route) { <nz-option [nzValue]="route" [nzLabel]="routeLabels[route]" /> }
                  </nz-select>
                  @if (err(index, 'route'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
                <div class="c-field">
                  <label class="c-field__label" [for]="id(index, 'times')">Prises par jour *</label>
                  <input
                    nz-input
                    inputmode="numeric"
                    [id]="id(index, 'times')"
                    [value]="line.timesPerDay"
                    [attr.aria-invalid]="err(index, 'frequency') ? 'true' : null"
                    (input)="patch(index, { timesPerDay: text($event) })"
                  />
                  @if (err(index, 'frequency'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
              </div>
              <label nz-checkbox class="c-long-term" [nzId]="id(index, 'long-term')" [ngModel]="line.longTerm" (ngModelChange)="patch(index, { longTerm: $event })">
                Traitement au long cours
              </label>
              <div class="c-grid">
                @if (!line.longTerm) {
                <div class="c-field">
                  <label class="c-field__label" [for]="id(index, 'duration')">Durée *</label>
                  <div class="c-duration">
                    <input
                      nz-input
                      inputmode="numeric"
                      [id]="id(index, 'duration')"
                      [value]="line.durationValue"
                      [attr.aria-invalid]="err(index, 'duration') ? 'true' : null"
                      (input)="patch(index, { durationValue: text($event) })"
                    />
                    <nz-select
                      [nzId]="id(index, 'duration-unit')"
                      [ngModel]="line.durationUnit"
                      [attr.aria-label]="'Unité de durée du médicament ' + (index + 1)"
                      (ngModelChange)="patch(index, { durationUnit: $event })"
                    >
                      @for (unit of durationUnits; track unit) { <nz-option [nzValue]="unit" [nzLabel]="durationLabels[unit]" /> }
                    </nz-select>
                  </div>
                  @if (err(index, 'duration'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
                }
                <div class="c-field">
                  <label class="c-field__label" [for]="id(index, 'quantity')">Quantité</label>
                  <input
                    nz-input
                    inputmode="numeric"
                    [id]="id(index, 'quantity')"
                    [value]="line.quantity"
                    [attr.aria-invalid]="err(index, 'quantity') ? 'true' : null"
                    (input)="patch(index, { quantity: text($event) })"
                  />
                  @if (err(index, 'quantity'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
              </div>
              <div class="c-field">
                <label class="c-field__label" [for]="id(index, 'instructions')">Instructions</label>
                <textarea
                  nz-input
                  rows="2"
                  [id]="id(index, 'instructions')"
                  [value]="line.instructions"
                  [attr.maxlength]="limits.instructions"
                  [attr.aria-invalid]="err(index, 'instructions') ? 'true' : null"
                  (input)="patch(index, { instructions: text($event) })"
                ></textarea>
                @if (err(index, 'instructions'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
              </div>
            </fieldset>
          }
          @if (ui.error('prescription.medications'); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
          @if (!signed()) {
            <div class="c-inline">
              <button nz-button type="button" [disabled]="atCap()" (click)="session.addMedicationLine()">
                <nz-icon nzType="plus" aria-hidden="true" /> Ajouter un médicament
              </button>
              @if (atCap()) {
                <span class="c-field__hint">Une ordonnance peut contenir au plus {{ session.rules.maxMedications }} médicaments.</span>
              }
            </div>
            <p class="c-helper">L’ordonnance est signée au moment de terminer la consultation.</p>
          }
        }
      </div>
    </section>
  `,
  styleUrl: './consultation-sections.scss',
  styles: `
    .c-line { position: relative; margin: 0; min-width: 0; }
    .c-line legend { float: left; width: 100%; padding: 0; margin: 0; }
    .c-line legend + * { clear: both; }
    .c-line__remove { position: absolute; inset-block-start: var(--oc-space-2); inset-inline-end: var(--oc-space-2); }
    .c-long-term { justify-self: start; color: var(--oc-color-text-primary); }
    .c-duration { display: grid; grid-template-columns: minmax(64px, 1fr) minmax(110px, 1.2fr); gap: var(--oc-space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreatmentSection {
  readonly session = inject(ConsultationSessionStore);
  readonly ui = inject(ConsultationUi);
  readonly number = input.required<number>();

  readonly decisions = DECISIONS;
  // Getters, not fields: module constants are read when rendering (see the P2b report, §7).
  get units(): typeof DOSE_UNITS { return DOSE_UNITS; }
  get unitLabels(): typeof DOSE_UNIT_LABELS { return DOSE_UNIT_LABELS; }
  get routes(): typeof ROUTES { return ROUTES; }
  get routeLabels(): typeof ROUTE_LABELS { return ROUTE_LABELS; }
  get durationUnits(): typeof DURATION_UNITS { return DURATION_UNITS; }
  get durationLabels(): typeof DURATION_UNIT_LABELS { return DURATION_UNIT_LABELS; }
  get limits(): typeof TEXT_LIMITS { return TEXT_LIMITS; }

  /** Mirrors the decision; reverted when a confirmation is declined. */
  readonly choice = linkedSignal<MedicationDecision | null>(() => this.session.note().medicationDecision);
  readonly signed = computed(() => this.session.prescriptionSigned());
  readonly atCap = computed(() => this.session.lines().length >= this.session.rules.maxMedications);
  readonly duplicates = computed(() => duplicateMedicationIndexes(this.session.lines()));
  readonly decisionError = computed(() => this.ui.error(NOTE_PATHS.medicationDecision));

  async choose(value: string | number): Promise<void> {
    const decision = value as MedicationDecision;
    const previous = this.session.note().medicationDecision;
    this.choice.set(decision);
    if (decision === previous) return;
    if (decision === 'NO_MEDICATION' && this.session.prescriptionHasData()) {
      const confirmed = await this.ui.confirm({
        title: 'Retirer l’ordonnance ?',
        message: DISCARD_MESSAGE,
        confirmLabel: 'Retirer',
        destructive: true,
      });
      if (!confirmed) {
        this.choice.set(previous);
        return;
      }
    }
    if (!(await this.session.setMedicationDecision(decision))) this.choice.set(previous);
  }

  async remove(index: number): Promise<void> {
    const line = this.session.lines()[index];
    if (line && line.name.trim() !== '') {
      const confirmed = await this.ui.confirm({
        title: 'Retirer ce médicament ?',
        message: `« ${line.name.trim()} » sera retiré de l’ordonnance.`,
        confirmLabel: 'Retirer',
        destructive: true,
      });
      if (!confirmed) return;
    }
    await this.session.removeMedicationLine(index);
  }

  patch(index: number, patch: Partial<MedicationLineForm>): void {
    this.session.updateMedicationLine(index, patch as Partial<MedicationLineForm> & {
      unit?: DoseUnit | null; route?: AdministrationRoute | null; durationUnit?: DurationUnit;
    });
  }


  path(index: number, field: string): string {
    return medicationPath(index, field);
  }

  err(index: number, field: string): string | null {
    return this.ui.errorUnder(medicationPath(index, field));
  }

  id(index: number, field: string): string {
    return `medication-${index}-${field}`;
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
