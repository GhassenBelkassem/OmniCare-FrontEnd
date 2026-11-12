import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';

import type { SummaryStatus } from '../../clinical-record.models';
import { ConsultationSessionStore } from '../consultation-session.store';
import { ConsultationSectionDirective } from '../consultation-section.directive';
import { ConsultationUi } from '../consultation-ui';
import { NOTE_PATHS, type MedicalSummaryForm, type SummaryListForm } from '../model/consultation-form';
import { BLOOD_GROUPS, TEXT_LIMITS } from '../model/consultation-rules';

type ListKey = 'allergies' | 'conditions';

const STATUS_OPTIONS: Readonly<Record<ListKey, { label: string; value: SummaryStatus }[]>> = {
  allergies: [
    { label: 'Non renseigné', value: 'UNKNOWN' },
    { label: 'Aucune connue', value: 'NONE_KNOWN' },
    { label: 'Saisir des allergies', value: 'LIST' },
  ],
  conditions: [
    { label: 'Non renseigné', value: 'UNKNOWN' },
    { label: 'Aucun connu', value: 'NONE_KNOWN' },
    { label: 'Saisir des antécédents', value: 'LIST' },
  ],
};

/** Section 3: allergies, antécédents and blood type, written at Finish (custodian only). */
@Component({
  selector: 'app-medical-summary-section',
  imports: [ConsultationSectionDirective, FormsModule, NzButtonModule, NzInputModule, NzSegmentedModule, NzSelectModule, NzTagModule],
  template: `
    <section class="c-card" id="consultation-dossier" appConsultationSection="dossier" aria-labelledby="summary-title">
      <header class="c-card__header">
        <div class="c-card__title">
          <span class="c-card__number" aria-hidden="true">{{ number() }}</span>
          <h2 id="summary-title">Mise à jour du dossier médical</h2>
        </div>
      </header>
      <div class="c-card__body">
        @for (list of lists; track list.key) {
          <div class="c-field" [attr.data-invalid]="listError(list.key) ? 'true' : null">
            <span class="c-field__label" [id]="'summary-' + list.key">{{ list.label }}</span>
            <nz-segmented
              [nzOptions]="statusOptions[list.key]"
              [ngModel]="summary()[list.key].status"
              (ngModelChange)="setStatus(list.key, $event)"
              [attr.aria-labelledby]="'summary-' + list.key"
            />
            @if (summary()[list.key].status === 'LIST') {
              <div class="c-inline" role="list" [attr.aria-label]="list.label">
                @for (item of summary()[list.key].items; track $index) {
                  <nz-tag role="listitem" nzMode="closeable" [class]="'c-chip c-chip--' + list.tone" (nzOnClose)="removeItem(list.key, $index)">{{ item }}</nz-tag>
                }
              </div>
              <div class="c-inline">
                <input
                  nz-input
                  [id]="'summary-' + list.key + '-input'"
                  [attr.aria-label]="list.addLabel"
                  [placeholder]="list.placeholder"
                  [attr.maxlength]="maxItem"
                  [value]="drafts()[list.key]"
                  [attr.aria-invalid]="listError(list.key) ? 'true' : null"
                  (input)="setDraft(list.key, $event)"
                  (keydown.enter)="addItem(list.key, $event)"
                />
                <button nz-button type="button" [disabled]="drafts()[list.key].trim() === ''" (click)="addItem(list.key)">Ajouter</button>
              </div>
            }
            @if (listError(list.key); as message) {
              <p class="c-field__error" role="alert">{{ message }}</p>
            }
          </div>
        }

        <div class="c-field c-field--narrow">
          <label class="c-field__label" for="summary-blood">Groupe sanguin</label>
          <nz-select
            nzId="summary-blood"
            [ngModel]="summary().bloodType"
            (ngModelChange)="setBloodType($event)"
            [attr.aria-invalid]="ui.error(bloodPath) ? 'true' : null"
          >
            <nz-option nzValue="UNKNOWN" nzLabel="Non renseigné" />
            @for (group of bloodGroups; track group) {
              <nz-option [nzValue]="group" [nzLabel]="group" />
            }
          </nz-select>
          @if (ui.error(bloodPath); as message) {
            <p class="c-field__error" role="alert">{{ message }}</p>
          }
        </div>

        <p class="c-helper">Enregistré dans le dossier du patient à la fin de la consultation.</p>
      </div>
    </section>
  `,
  styleUrl: './consultation-sections.scss',
  styles: `.c-field--narrow { max-width: 240px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalSummarySection {
  readonly session = inject(ConsultationSessionStore);
  readonly ui = inject(ConsultationUi);
  readonly number = input.required<number>();

  readonly statusOptions = STATUS_OPTIONS;
  get bloodGroups(): typeof BLOOD_GROUPS { return BLOOD_GROUPS; }
  get bloodPath(): string { return NOTE_PATHS.bloodType; }
  get maxItem(): number { return TEXT_LIMITS.summaryItem; }
  readonly lists = [
    { key: 'allergies' as const, tone: 'allergy', label: 'Allergies', addLabel: 'Ajouter une allergie', placeholder: 'Ex. : pénicilline' },
    { key: 'conditions' as const, tone: 'history', label: 'Antécédents', addLabel: 'Ajouter un antécédent', placeholder: 'Ex. : asthme' },
  ];
  readonly drafts = signal<Readonly<Record<ListKey, string>>>({ allergies: '', conditions: '' });
  readonly summary = computed<MedicalSummaryForm>(() => this.session.note().summary);

  path(key: ListKey): string {
    return key === 'allergies' ? NOTE_PATHS.allergies : NOTE_PATHS.conditions;
  }

  listError(key: ListKey): string | null {
    return this.ui.errorUnder(this.path(key));
  }

  setStatus(key: ListKey, status: string | number): void {
    const value = status as SummaryStatus;
    this.patchList(key, { status: value, items: value === 'LIST' ? this.summary()[key].items : [] });
  }

  setDraft(key: ListKey, event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.drafts.update((drafts) => ({ ...drafts, [key]: text }));
  }

  addItem(key: ListKey, event?: Event): void {
    event?.preventDefault();
    const text = this.drafts()[key].trim();
    if (text === '') return;
    const items = this.summary()[key].items;
    if (!items.some((item) => item.toLocaleLowerCase('fr-FR') === text.toLocaleLowerCase('fr-FR'))) {
      this.patchList(key, { status: 'LIST', items: [...items, text] });
    }
    this.drafts.update((drafts) => ({ ...drafts, [key]: '' }));
  }

  removeItem(key: ListKey, index: number): void {
    this.patchList(key, { status: 'LIST', items: this.summary()[key].items.filter((_, position) => position !== index) });
  }

  setBloodType(value: string): void {
    this.session.updateNote({ summary: { ...this.summary(), bloodType: value ?? 'UNKNOWN' } });
  }

  private patchList(key: ListKey, list: SummaryListForm): void {
    this.session.updateNote({ summary: { ...this.summary(), [key]: list } });
  }
}
