import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, distinctUntilChanged, map, of, switchMap, tap, timer } from 'rxjs';

import { OcButton } from '../../shared/ui';
import type { PracticePatientDto, PracticePatientFilterDto } from './practice-patient-api.models';
import { PracticePatientApiService } from './practice-patient-api.service';

interface PatientSearchResult {
  readonly patients: readonly PracticePatientDto[];
  readonly failed: boolean;
}

@Component({
  selector: 'app-patient-lookup-dialog',
  imports: [OcButton],
  templateUrl: './patient-lookup-dialog.html',
  styleUrl: './patient-lookup-dialog.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientLookupDialog {
  readonly open = input(false);
  readonly filter = input<PracticePatientFilterDto>('ALL');
  readonly title = input('Rechercher un patient');
  readonly description = input(
    "Trouver un patient par nom ou téléphone quand le scan QR n'est pas disponible.",
  );
  readonly selected = output<PracticePatientDto>();
  readonly dismissed = output<void>();

  private readonly api = inject(PracticePatientApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTerms = new Subject<string>();

  readonly query = signal('');
  readonly results = signal<readonly PracticePatientDto[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);

  constructor() {
    this.searchTerms
      .pipe(
        map((value) => value.trim()),
        distinctUntilChanged(),
        tap(() => {
          this.loading.set(false);
          this.failed.set(false);
        }),
        switchMap((query) => {
          if (query.length < 2) {
            return of<PatientSearchResult>({ patients: [], failed: false });
          }
          return timer(250).pipe(
            tap(() => this.loading.set(true)),
            switchMap(() =>
              this.api.listPatients({ query, filter: this.filter(), page: 0, size: 8 }).pipe(
                map((response): PatientSearchResult => ({
                  patients: response.content,
                  failed: false,
                })),
                catchError(() => of<PatientSearchResult>({ patients: [], failed: true })),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        this.failed.set(result.failed);
        this.results.set(result.patients);
      });
  }

  updateQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.searchTerms.next(value);
  }

  select(match: PracticePatientDto): void {
    this.reset();
    this.selected.emit(match);
  }

  dismiss(): void {
    this.reset();
    this.dismissed.emit();
  }

  onEscape(): void {
    if (this.open()) this.dismiss();
  }

  private reset(): void {
    this.query.set('');
    this.results.set([]);
    this.loading.set(false);
    this.failed.set(false);
    this.searchTerms.next('');
  }

  patientName(patient: PracticePatientDto): string {
    return `${patient.firstName} ${patient.lastName}`.trim() || 'Patient sans nom';
  }
}
