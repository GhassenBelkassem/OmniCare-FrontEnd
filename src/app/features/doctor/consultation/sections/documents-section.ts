import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

import { OcDateField } from '../../../../shared/ui';
import { ConsultationFinishFlow } from '../consultation-finish.flow';
import { ConsultationSessionStore } from '../consultation-session.store';
import { SickLeaveTemplatePicker } from '../sick-leave-template-picker';
import { ConsultationSectionDirective } from '../consultation-section.directive';
import { ConsultationUi, DISCARD_MESSAGE } from '../consultation-ui';
import { addDays, sickLeaveDays, type CertificateType } from '../model/consultation-form';
import { TEXT_LIMITS } from '../model/consultation-rules';

const DOCUMENTS: readonly { readonly type: CertificateType; readonly label: string }[] = [
  { type: 'SICK_LEAVE_CERTIFICATE', label: 'Arrêt de travail' },
  { type: 'MEDICAL_CERTIFICATE', label: 'Certificat médical' },
];

/** Section 7 (optional): sick leave and medical certificate, each revealed by its toggle. */
@Component({
  selector: 'app-documents-section',
  imports: [ConsultationSectionDirective, FormsModule, NzInputModule, NzSelectModule, NzSwitchModule, OcDateField],
  template: `
    <section class="c-card" id="consultation-documents" appConsultationSection="documents" aria-labelledby="documents-title">
      <header class="c-card__header">
        <div class="c-card__title">
          <span class="c-card__number" aria-hidden="true">{{ number() }}</span>
          <h2 id="documents-title">Documents <span class="c-optional">(facultatif)</span></h2>
        </div>
      </header>
      <div class="c-card__body">
        @for (document of documents; track document.type) {
          @let row = session.certificates()[document.type];
          <div class="c-document">
            <label class="c-toggle" [for]="'document-' + document.type">
              <nz-switch
                [nzId]="'document-' + document.type"
                [ngModel]="enabled()[document.type]"
                [nzDisabled]="signed(document.type)"
                (ngModelChange)="toggle(document.type, $event)"
              />
              <span>{{ document.label }}</span>
            </label>
            @if (row !== null) {
              <div class="c-subcard">
                @if (signed(document.type)) {
                  <p class="c-helper">Document signé.</p>
                }
                @if (document.type === 'SICK_LEAVE_CERTIFICATE' && templates.visible() && !signed(document.type)) {
                  <div class="c-field c-template">
                    <label class="c-field__label" for="sick-leave-template">Modèle</label>
                    <nz-select
                      nzId="sick-leave-template"
                      nzPlaceHolder="Choisir un modèle"
                      [ngModel]="templates.selectedId()"
                      [nzDisabled]="flow.busy()"
                      (ngModelChange)="templates.select($event)"
                    >
                      @for (option of templates.options(); track option.id) {
                        <nz-option [nzValue]="option.id" [nzLabel]="option.label" />
                      }
                    </nz-select>
                    <p class="c-field__hint">L’arrêt de travail sera imprimé sur ce modèle à la signature.</p>
                  </div>
                }
                @if (document.type === 'SICK_LEAVE_CERTIFICATE') {
                  <div class="c-grid">
                    <div class="c-field" [attr.data-invalid]="ui.error(key(document.type, 'startDate')) ? 'true' : null">
                      <label class="c-field__label" for="sick-leave-start">Début *</label>
                      <oc-date-field
                        controlId="sick-leave-start"
                        ariaLabel="Début de l’arrêt de travail"
                        [value]="row.form.startDate"
                        [invalid]="!!ui.error(key(document.type, 'startDate'))"
                        (valueChange)="setDate('startDate', $event)"
                      />
                      @if (ui.error(key(document.type, 'startDate')); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                    </div>
                    <div class="c-field" [attr.data-invalid]="ui.error(key(document.type, 'endDate')) ? 'true' : null">
                      <label class="c-field__label" for="sick-leave-end">Fin *</label>
                      <oc-date-field
                        controlId="sick-leave-end"
                        ariaLabel="Fin de l’arrêt de travail"
                        [value]="row.form.endDate"
                        [min]="row.form.startDate"
                        [max]="maxEnd()"
                        [invalid]="!!ui.error(key(document.type, 'endDate'))"
                        (valueChange)="setDate('endDate', $event)"
                      />
                      @if (ui.error(key(document.type, 'endDate')); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                    </div>
                    <div class="c-field">
                      <span class="c-field__label" id="sick-leave-duration-label">Durée</span>
                      <p class="c-duration-value" aria-labelledby="sick-leave-duration-label">{{ durationLabel() }}</p>
                    </div>
                  </div>
                }
                <div class="c-field">
                  <div class="c-field__row">
                    <label class="c-field__label" [for]="'statement-' + document.type">Déclaration *</label>
                    <span class="c-field__hint">{{ length(row.form.statement) }} / {{ maxStatement }}</span>
                  </div>
                  <textarea
                    nz-input
                    rows="3"
                    [id]="'statement-' + document.type"
                    [value]="row.form.statement"
                    [disabled]="signed(document.type)"
                    [attr.maxlength]="maxStatement"
                    [attr.aria-invalid]="ui.error(key(document.type, 'statement')) ? 'true' : null"
                    (input)="session.updateCertificate(document.type, { statement: text($event) })"
                  ></textarea>
                  @if (ui.error(key(document.type, 'statement')); as message) { <p class="c-field__error" role="alert">{{ message }}</p> }
                </div>
              </div>
            }
          </div>
        }
        <p class="c-helper">Les documents sont signés au moment de terminer la consultation.</p>
      </div>
    </section>
  `,
  styleUrl: './consultation-sections.scss',
  styles: `
    .c-optional { color: var(--oc-color-text-muted); font-size: var(--oc-text-small-size); font-weight: var(--oc-font-weight-semibold); }
    .c-document { display: grid; gap: var(--oc-space-3); }
    .c-toggle { display: inline-flex; align-items: center; gap: var(--oc-space-3); color: var(--oc-color-text-primary); font-weight: var(--oc-font-weight-semibold); cursor: pointer; }
    .c-duration-value { margin: 0; padding-block: 5px; color: var(--oc-color-text-primary); }
    .c-template { max-width: 28rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsSection {
  readonly session = inject(ConsultationSessionStore);
  readonly ui = inject(ConsultationUi);
  readonly flow = inject(ConsultationFinishFlow);
  /** G-1 D5: hidden when the doctor has no active sick-leave template or the list failed. */
  readonly templates = inject(SickLeaveTemplatePicker);
  readonly number = input.required<number>();

  constructor() {
    this.templates.ensureLoaded();
  }

  readonly documents = DOCUMENTS;
  get maxStatement(): number { return TEXT_LIMITS.statement; }
  /** Mirrors the toggles; reverted when a confirmation is declined. */
  private readonly pending = signal<Partial<Record<CertificateType, boolean>>>({});
  readonly enabled = computed<Record<CertificateType, boolean>>(() => {
    const certificates = this.session.certificates();
    const pending = this.pending();
    return {
      SICK_LEAVE_CERTIFICATE: pending.SICK_LEAVE_CERTIFICATE ?? certificates.SICK_LEAVE_CERTIFICATE !== null,
      MEDICAL_CERTIFICATE: pending.MEDICAL_CERTIFICATE ?? certificates.MEDICAL_CERTIFICATE !== null,
    };
  });

  readonly maxEnd = computed(() => {
    const start = this.session.certificates().SICK_LEAVE_CERTIFICATE?.form.startDate;
    return start ? addDays(start, this.session.rules.sickLeaveMaxDays - 1) : null;
  });

  readonly durationLabel = computed(() => {
    const row = this.session.certificates().SICK_LEAVE_CERTIFICATE;
    if (row === null) return '—';
    const days = sickLeaveDays(row.form) ?? row.server?.definition.certificate?.durationDays ?? null;
    if (days === null || days < 1) return '—';
    return days === 1 ? '1 jour' : `${days} jours`;
  });

  async toggle(type: CertificateType, enabled: boolean): Promise<void> {
    this.pending.update((value) => ({ ...value, [type]: enabled }));
    try {
      if (!enabled && this.session.certificateHasData(type)) {
        const confirmed = await this.ui.confirm({
          title: 'Retirer ce document ?',
          message: DISCARD_MESSAGE,
          confirmLabel: 'Retirer',
          destructive: true,
        });
        if (!confirmed) return;
      }
      await this.session.setCertificateEnabled(type, enabled);
    } finally {
      this.pending.update((value) => ({ ...value, [type]: undefined }));
    }
  }

  setDate(field: 'startDate' | 'endDate', value: string | null): void {
    this.session.updateCertificate('SICK_LEAVE_CERTIFICATE', { [field]: value });
  }

  signed(type: CertificateType): boolean {
    return this.session.certificates()[type]?.server?.status === 'FINALIZED';
  }

  key(type: CertificateType, field: string): string {
    return `artifact:${type}.${field}`;
  }

  length(value: string): number {
    return Array.from(value).length;
  }

  text(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }
}
