import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

import { OcButton, OcDateBlock, OcStatusTag } from '../../../shared/ui';
import type { PatientChartDto } from './patient-chart-api.models';
import { tunisTime, weekdayDate } from './record/record-format';

/**
 * « Prochain rendez-vous » (patient page only): date, time, cabinet and status of the next
 * appointment, or « Aucun rendez-vous à venir » with « Planifier » when scheduling is possible.
 */
@Component({
  selector: 'app-chart-next-appointment-card',
  imports: [NzIconModule, OcButton, OcDateBlock, OcStatusTag],
  template: `
    <section class="r-card n-card" aria-labelledby="next-title" data-testid="next-appointment-card">
      <div class="r-heading">
        <span class="r-tile r-tile--care" aria-hidden="true"><nz-icon nzType="calendar" /></span>
        <div class="r-heading__text"><h3 id="next-title">Prochain rendez-vous</h3></div>
      </div>
      @if (next(); as appointment) {
        <div class="n-row" data-testid="next-appointment">
          <oc-date-block [date]="appointment.startTime" tone="care" />
          <div class="n-row__text">
            <p class="n-row__date">{{ day(appointment.startTime) }}</p>
            <p class="r-secondary">{{ line() }}</p>
          </div>
          <oc-status-tag [status]="appointment.status" />
        </div>
      } @else {
        <div class="n-empty" data-testid="next-appointment-empty">
          <p class="r-secondary">Aucun rendez-vous à venir.</p>
          @if (chart().schedulable) {
            <oc-button size="small" variant="outline" leadingIcon="calendar" (click)="schedule.emit()">Planifier</oc-button>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './record/record-cards.scss',
  styles: `
    .n-card { align-content: start; }
    .n-row { display: flex; align-items: center; gap: var(--oc-space-4); }
    .n-row__text { display: grid; flex: 1; gap: 2px; min-width: 0; }
    .n-row__date { margin: 0; color: var(--oc-ink); font-size: 18px; font-weight: var(--oc-font-weight-strong); }
    .n-empty { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--oc-space-3); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartNextAppointmentCard {
  readonly chart = input.required<PatientChartDto>();
  readonly schedule = output<void>();

  readonly next = computed(() => this.chart().nextAppointment);
  /** « 09:00 · Cabinet El Menzah » (the cabinet only when the appointment has one). */
  readonly line = computed(() => {
    const next = this.next();
    if (!next) return '';
    return [tunisTime(next.startTime), next.locationName].filter(Boolean).join(' · ');
  });

  day(value: string): string {
    const text = weekdayDate(value);
    return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
  }
}
