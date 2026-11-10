import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton, OcEmptyState, OcSectionCard } from '../../../shared/ui';
import type {
  PatientChartAccessDto,
  PatientChartHistoryDto,
  PatientChartHistoryEventDto,
} from './patient-chart-api.models';
import { PatientChartApiService } from './patient-chart-api.service';
import {
  HISTORY_KIND,
  chartDateTime,
  chartDayHeading,
  chartDayKey,
  chartTime,
  isAccessRequiredError,
  mayLoadClinical,
} from './patient-chart-format';
import { ChartAccessRequired } from './chart-access-required';

export interface HistoryDayGroup {
  readonly key: string;
  readonly heading: string;
  readonly events: readonly PatientChartHistoryEventDto[];
}

export function groupHistoryByDay(events: readonly PatientChartHistoryEventDto[]): HistoryDayGroup[] {
  const groups: HistoryDayGroup[] = [];
  for (const event of events) {
    const key = chartDayKey(event.occurredAt);
    const last = groups.at(-1);
    if (last && last.key === key) {
      (last.events as PatientChartHistoryEventDto[]).push(event);
    } else {
      groups.push({ key, heading: chartDayHeading(event.occurredAt), events: [event] });
    }
  }
  return groups;
}

@Component({
  selector: 'app-chart-history-tab',
  imports: [RouterLink, NzIconModule, NzSkeletonModule, OcButton, OcEmptyState, OcSectionCard, ChartAccessRequired],
  template: `
    <oc-section-card title="Historique" icon="history">
      @if (state() === 'loading') {
        <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 6 }" />
      } @else if (state() === 'denied') {
        <app-chart-access-required />
      } @else if (state() === 'error') {
        <div class="chart-error" role="alert">
          <p>L’historique n’a pas pu être chargé.</p>
          <oc-button size="small" (click)="load()">Réessayer</oc-button>
        </div>
      } @else if (data(); as history) {
        @if (!clinicalAllowed()) {
          <p class="chart-muted chart-block-gap">
            Seuls les événements administratifs sont affichés. Les événements médicaux nécessitent
            l’autorisation du patient.
          </p>
        } @else if (history.clinicalUnavailable) {
          <p class="chart-muted chart-block-gap" role="status">
            Les événements médicaux sont momentanément indisponibles.
          </p>
        }
        @if (groups().length === 0) {
          <oc-empty-state icon="history" title="Aucun événement" description="L’historique du patient apparaîtra ici." />
        } @else {
          <div class="history" data-testid="history">
            @for (group of groups(); track group.key) {
              <section class="history__day" [attr.aria-label]="group.heading">
                <h3 class="history__heading">{{ group.heading }}</h3>
                <ol class="history__events">
                  @for (event of group.events; track event.id) {
                    <li class="history__event" [class]="'history__event history__event--' + kind(event).tone">
                      <span class="history__icon" aria-hidden="true"><nz-icon [nzType]="kind(event).icon" /></span>
                      <span class="history__time">{{ time(event.occurredAt) }}</span>
                      <span class="history__text">
                        {{ kind(event).text }}
                        @if (event.appointmentStart && event.kind.startsWith('APPOINTMENT')) {
                          <span class="chart-muted"> · le {{ dateTime(event.appointmentStart) }}</span>
                        }
                        @if (event.label) {
                          <span class="chart-muted"> · {{ event.label }}</span>
                        }
                      </span>
                      @switch (event.targetType) {
                        @case ('APPOINTMENT') {
                          <a class="history__link" [routerLink]="['/doctor', 'calendar']" [queryParams]="{ appointmentId: event.targetId }">
                            Voir
                          </a>
                        }
                        @case ('CONSULTATION') {
                          <button type="button" class="history__link" (click)="openTab.emit('consultations')">Voir</button>
                        }
                        @case ('DOCUMENT') {
                          <button type="button" class="history__link" (click)="openTab.emit('documents')">Voir</button>
                        }
                      }
                    </li>
                  }
                </ol>
              </section>
            }
          </div>
        }
      }
    </oc-section-card>
  `,
  styleUrl: './patient-chart-cards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartHistoryTab {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientId = input.required<string>();
  readonly access = input.required<PatientChartAccessDto>();
  readonly openTab = output<'consultations' | 'documents'>();

  readonly state = signal<'loading' | 'ready' | 'error' | 'denied'>('loading');
  readonly clinicalAllowed = computed(() => mayLoadClinical(this.access()));
  readonly data = signal<PatientChartHistoryDto | null>(null);
  readonly groups = computed(() => groupHistoryByDay(this.data()?.items ?? []));

  constructor() {
    effect(() => {
      this.patientId();
      this.access();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.state.set('loading');
    this.api
      .getHistory(this.patientId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.state.set('ready');
        },
        error: (error: unknown) => this.state.set(isAccessRequiredError(error) ? 'denied' : 'error'),
      });
  }

  kind(event: PatientChartHistoryEventDto) {
    return HISTORY_KIND[event.kind] ?? { icon: 'clock-circle', text: 'Événement', tone: 'neutral' as const };
  }

  time(value: string): string {
    return chartTime(value);
  }

  dateTime(value: string): string {
    return chartDateTime(value);
  }
}
