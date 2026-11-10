import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { OcButton, OcEmptyState, OcSectionCard } from '../../../shared/ui';
import { ChartAccessRequired } from './chart-access-required';
import type {
  PatientChartAccessDto,
  PatientChartArtifactRefDto,
  PatientChartClinicalConsultationDto,
  PatientChartConsultationsDto,
} from './patient-chart-api.models';
import { PatientChartApiService } from './patient-chart-api.service';
import {
  chartLongDate,
  chartTime,
  consultationStatusLabel,
  isAccessRequiredError,
} from './patient-chart-format';

@Component({
  selector: 'app-chart-consultations-tab',
  imports: [NzSkeletonModule, NzTagModule, OcButton, OcEmptyState, OcSectionCard, ChartAccessRequired],
  template: `
    <oc-section-card title="Consultations" icon="medicine-box" subtitle="De la plus récente à la plus ancienne">
      @if (state() === 'loading') {
        <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 5 }" />
      } @else if (state() === 'denied') {
        <app-chart-access-required />
      } @else if (state() === 'error') {
        <div class="chart-error" role="alert">
          <p>Les consultations n’ont pas pu être chargées.</p>
          <oc-button size="small" (click)="load()">Réessayer</oc-button>
        </div>
      } @else if (data(); as consultations) {
        @if (consultations.view === 'ADMINISTRATIVE' && access().mode === 'OMNICARE_RESTRICTED') {
          <app-chart-access-required class="chart-block-gap" />
        }
        @if (consultations.items.length === 0) {
          <oc-empty-state
            icon="calendar"
            title="Aucune consultation"
            description="Les consultations avec ce patient apparaîtront ici."
          >
            @if (schedulable()) {
              <oc-button variant="primary" leadingIcon="calendar" (click)="schedule.emit()">
                Planifier un rendez-vous
              </oc-button>
            }
          </oc-empty-state>
        } @else {
          <ul class="chart-list" data-testid="consultation-list">
            @if (consultations.view === 'CLINICAL') {
              @for (item of consultations.items; track item.id) {
                <li class="chart-list__item consultation-item">
                  <div class="chart-list__date">
                    <strong>{{ day(item.date) }}</strong>
                    <span>{{ time(item.date) }}</span>
                  </div>
                  <div class="chart-list__body">
                    <p class="chart-list__title">
                      {{ item.reason || (item.clinicalAvailable ? 'Motif non renseigné' : 'Consultation') }}
                    </p>
                    @if (item.diagnosisSummary) {
                      <p class="chart-list__meta">{{ item.diagnosisSummary }}</p>
                    } @else if (!item.clinicalAvailable && item.status === 'COMPLETED') {
                      <p class="chart-list__meta">Compte rendu non partagé</p>
                    }
                    @if (!item.ownConsultation) {
                      <p class="chart-list__meta">Autre praticien</p>
                    }
                  </div>
                  <div class="chart-list__actions">
                    <nz-tag [class]="'consultation-status consultation-status--' + item.status.toLowerCase()">
                      {{ statusLabel(item.status) }}
                    </nz-tag>
                    @for (artifact of item.artifacts; track artifact.id) {
                      <oc-button
                        size="small"
                        variant="outline"
                        leadingIcon="download"
                        [loading]="downloading() === artifact.id"
                        (click)="download(item, artifact)"
                      >
                        {{ artifact.kind === 'PRESCRIPTION' ? 'Ordonnance' : 'Certificat' }}
                      </oc-button>
                    }
                  </div>
                </li>
              }
            } @else {
              @for (item of consultations.items; track item.id) {
                <li class="chart-list__item consultation-item">
                  <div class="chart-list__date">
                    <strong>{{ day(item.date) }}</strong>
                    <span>{{ time(item.date) }}</span>
                  </div>
                  <div class="chart-list__body">
                    <p class="chart-list__title">Consultation</p>
                  </div>
                  <div class="chart-list__actions">
                    <nz-tag [class]="'consultation-status consultation-status--' + item.status.toLowerCase()">
                      {{ statusLabel(item.status) }}
                    </nz-tag>
                  </div>
                </li>
              }
            }
          </ul>
        }
        @if (downloadError(); as message) {
          <p class="chart-inline-error" role="alert">{{ message }}</p>
        }
      }
    </oc-section-card>
  `,
  styleUrl: './patient-chart-cards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartConsultationsTab {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientId = input.required<string>();
  readonly access = input.required<PatientChartAccessDto>();
  readonly schedulable = input(false);
  readonly schedule = output<void>();

  readonly state = signal<'loading' | 'ready' | 'error' | 'denied'>('loading');
  readonly data = signal<PatientChartConsultationsDto | null>(null);
  readonly downloading = signal<string | null>(null);
  readonly downloadError = signal<string | null>(null);

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
      .getConsultations(this.patientId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.state.set('ready');
        },
        error: (error: unknown) => this.state.set(isAccessRequiredError(error) ? 'denied' : 'error'),
      });
  }

  download(item: PatientChartClinicalConsultationDto, artifact: PatientChartArtifactRefDto): void {
    if (this.downloading()) return;
    this.downloading.set(artifact.id);
    this.downloadError.set(null);
    this.api
      .downloadArtifact(this.patientId(), item.id, artifact.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.downloading.set(null);
          const name = artifact.kind === 'PRESCRIPTION' ? 'ordonnance' : 'certificat';
          saveBlob(blob, `${name}-${(item.date ?? '').slice(0, 10) || 'consultation'}.pdf`);
        },
        error: (error: unknown) => {
          this.downloading.set(null);
          this.downloadError.set(
            isAccessRequiredError(error)
              ? 'Accès requis : le patient doit vous autoriser à consulter ce document.'
              : 'Le document n’a pas pu être téléchargé. Réessayez.',
          );
        },
      });
  }

  day(value: string | null): string {
    return chartLongDate(value) || 'Date inconnue';
  }

  time(value: string | null): string {
    return chartTime(value);
  }

  statusLabel(status: string): string {
    return consultationStatusLabel(status);
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
