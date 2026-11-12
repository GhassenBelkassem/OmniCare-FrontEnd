import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { OcAvatar } from '../../../../shared/ui';
import { ageLabel, sexLabel } from '../../patient-chart/patient-chart-format';
import { ConsultationAbort } from '../consultation-abort';
import { ConsultationSessionStore } from '../consultation-session.store';
import { ConsultationUi } from '../consultation-ui';

const TUNIS_TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Tunis',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Patient identity, appointment times, save indicator and the « Dossier patient » link. */
@Component({
  selector: 'app-consultation-header',
  imports: [NzIconModule, NzTagModule, OcAvatar, ConsultationAbort],
  template: `
    @if (session.consultation(); as consultation) {
      <header class="c-header">
        <div class="c-header__identity">
          <oc-avatar [name]="patientName()" size="large" />
          <div class="c-header__text">
            <h1>{{ patientName() }}</h1>
            <div class="c-header__meta">
              @if (identityLine(); as line) { <span>{{ line }}</span> }
              @if (consultation.patient?.patientType === 'EXTERNAL') {
                <nz-tag class="c-tag c-tag--external">Patient externe</nz-tag>
              } @else if (consultation.patient) {
                <nz-tag class="c-tag c-tag--external">Patient OmniCare</nz-tag>
              }
              @if (consultation.status === 'IN_PROGRESS') {
                <nz-tag class="c-tag c-tag--progress">En cours</nz-tag>
              } @else if (consultation.status === 'FINALIZING') {
                <nz-tag class="c-tag c-tag--progress">Clôture en cours</nz-tag>
              } @else if (consultation.status === 'COMPLETED') {
                <nz-tag class="c-tag c-tag--done">Terminée</nz-tag>
              } @else if (consultation.status === 'ABORTED') {
                <nz-tag class="c-tag c-tag--done">Annulée</nz-tag>
              }
            </div>
            <p class="c-header__times">{{ timesLine() }}</p>
          </div>
        </div>
        <div class="c-header__aside">
          @if (consultation.status === 'IN_PROGRESS') {
            <p
              class="c-save"
              [class.c-save--attention]="indicator().kind === 'attention' || indicator().kind === 'retrying'"
              [class.c-save--offline]="indicator().kind === 'offline'"
              role="status"
              aria-live="polite"
            >
              <nz-icon [nzType]="indicatorIcon()" aria-hidden="true" />
              <span>{{ indicator().label }}</span>
            </p>
          }
          <app-consultation-abort />
          @if (session.consultation()?.patient) {
            <button type="button" class="c-header__link" aria-haspopup="dialog" (click)="ui.recordOpen.set(true)">
              <nz-icon nzType="folder-open" aria-hidden="true" />
              Dossier patient
            </button>
          }
        </div>
      </header>
    }
  `,
  styles: `
    :host { display: block; }
    .c-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--oc-space-4);
      padding: var(--oc-space-4) var(--oc-space-5);
      border: 1px solid var(--oc-color-border-default);
      border-radius: var(--oc-radius-lg);
      background: var(--oc-color-surface-card);
      box-shadow: var(--oc-shadow-card);
    }
    .c-header__identity { display: flex; min-width: 0; align-items: center; gap: var(--oc-space-4); }
    .c-header__text { display: grid; min-width: 0; gap: var(--oc-space-1); }
    h1 {
      margin: 0;
      color: var(--oc-color-text-primary);
      font-size: var(--oc-text-h2-size);
      font-weight: var(--oc-font-weight-strong);
      letter-spacing: -0.025em;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }
    .c-header__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--oc-space-2);
      color: var(--oc-color-text-secondary);
      font-size: var(--oc-text-small-size);
    }
    .c-tag {
      margin: 0;
      border-radius: var(--oc-radius-pill);
      font-size: var(--oc-text-caption-size);
      font-weight: var(--oc-font-weight-semibold);
    }
    .c-tag--external { border-color: transparent; background: var(--oc-primary-tint); color: var(--oc-primary-dark); }
    .c-tag--progress { border-color: transparent; background: var(--oc-violet-tint); color: var(--oc-violet-dark); }
    .c-tag--done { border-color: var(--oc-hairline); background: var(--oc-surface); color: var(--oc-ink-secondary); }
    .c-header__times { margin: 0; color: var(--oc-color-text-muted); font-size: var(--oc-text-caption-size); }
    .c-header__aside { display: flex; flex-wrap: wrap; align-items: center; gap: var(--oc-space-4); }
    .c-save {
      display: inline-flex;
      align-items: center;
      gap: var(--oc-space-2);
      margin: 0;
      color: var(--oc-color-text-secondary);
      font-size: var(--oc-text-small-size);
    }
    .c-save--attention { color: var(--oc-amber-dark); }
    .c-save--offline { color: var(--oc-error-dark); }
    .c-header__link {
      display: inline-flex;
      align-items: center;
      gap: var(--oc-space-2);
      color: var(--oc-primary-dark);
      font-weight: var(--oc-font-weight-semibold);
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      cursor: pointer;
      text-decoration: none;
    }
    .c-header__link:hover, .c-header__link:focus-visible { text-decoration: underline; }
    @media (max-width: 640px) { .c-header { padding: var(--oc-space-4); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultationHeader {
  readonly session = inject(ConsultationSessionStore);
  readonly ui = inject(ConsultationUi);
  readonly indicator = this.session.saveIndicator;

  readonly patientName = computed(() => this.session.consultation()?.patient?.fullName ?? 'Patient');

  readonly identityLine = computed(() => {
    const patient = this.session.consultation()?.patient;
    if (!patient) return null;
    return [ageLabel(patient), patient.sex ? sexLabel(patient.sex) : null].filter(Boolean).join(' · ') || null;
  });

  readonly timesLine = computed(() => {
    const consultation = this.session.consultation();
    if (!consultation) return '';
    const started = formatTime(consultation.startedAt);
    const appointment = formatTime(this.session.appointmentStartAt());
    const start = started ? `commencée à ${started}` : '';
    if (appointment) return `Rendez-vous de ${appointment}${start ? ` · ${start}` : ''}`;
    return start ? `Consultation ${start}` : '';
  });

  readonly indicatorIcon = computed(() => {
    switch (this.indicator().kind) {
      case 'saving': return 'sync';
      case 'saved': return 'check-circle';
      case 'offline': return 'disconnect';
      default: return 'exclamation-circle';
    }
  });
}

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : TUNIS_TIME.format(date);
}
