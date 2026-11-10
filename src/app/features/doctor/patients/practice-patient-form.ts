import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

import { OcButton, OcDateField, isRecentBirthDate, patientAgeLabel } from '../../../shared/ui';
import type {
  CreatePracticePatientRequestDto,
  PracticePatientDuplicateCandidateDto,
  PracticePatientDto,
  PracticePatientSexDto,
} from '../practice-patient-api.models';
import { PracticePatientApiService } from '../practice-patient-api.service';

const PHONE_PATTERN = /^[+0-9 ()./-]{6,32}$/;

export interface PatientFormPrefill {
  readonly lastName: string;
  readonly firstName: string;
  readonly phone: string;
}

/**
 * Splits a search text into form values: digits (with + and separators) become the phone,
 * remaining words become the names. One word → Nom; several → first is Prénom, the rest Nom.
 */
export function prefillFromSearch(text: string): PatientFormPrefill {
  const value = text.trim();
  const phoneMatch = value.match(/\+?\d[\d\s().\-/]*\d/u);
  const phone = phoneMatch ? phoneMatch[0].trim() : '';
  const words = (phoneMatch ? value.replace(phoneMatch[0], ' ') : value)
    .replace(/[+\d().\-/]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean)
    .map(capitalize);
  if (words.length === 0) return { lastName: '', firstName: '', phone };
  if (words.length === 1) return { lastName: words[0], firstName: '', phone };
  return { firstName: words[0], lastName: words.slice(1).join(' '), phone };
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1);
}

/**
 * Inline "create external patient" form (no modal): duplicate check shown inline,
 * Idempotency-Key per form session, French only.
 */
@Component({
  selector: 'app-practice-patient-form',
  imports: [FormsModule, ReactiveFormsModule, NzInputModule, NzRadioModule, NzSwitchModule, OcButton, OcDateField],
  templateUrl: './practice-patient-form.html',
  styleUrl: './practice-patient-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticePatientForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(PracticePatientApiService);
  private readonly lastNameInput = viewChild<ElementRef<HTMLInputElement>>('lastNameInput');

  /** Search text used to pre-fill the form when it opens. */
  readonly prefill = input('');
  readonly submitLabel = input('Créer et sélectionner');
  readonly created = output<PracticePatientDto>();
  /** Doctor chose an existing (similar) patient instead. */
  readonly useExisting = output<string>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly phoneConflictId = signal<string | null>(null);
  readonly duplicateCandidates = signal<readonly PracticePatientDuplicateCandidateDto[]>([]);
  readonly pendingRequest = signal<CreatePracticePatientRequestDto | null>(null);
  readonly moreOptions = signal(false);
  readonly today = todayDateValue();
  private createCommand: { readonly payload: string; readonly idempotencyKey: string } | null =
    null;

  readonly form = this.fb.group({
    lastName: ['', [Validators.required, Validators.maxLength(128)]],
    firstName: ['', [Validators.required, Validators.maxLength(128)]],
    sex: this.fb.control<PracticePatientSexDto | ''>('', Validators.required),
    approximate: this.fb.control(false),
    dateOfBirth: this.fb.control<string | null>(null),
    approximateAgeYears: this.fb.control<number | null>(null),
    phone: ['', [Validators.maxLength(32), Validators.pattern(PHONE_PATTERN)]],
    practiceIdentifier: ['', [Validators.maxLength(128)]],
  });

  private readonly dateOfBirthValue = toSignal(this.form.controls.dateOfBirth.valueChanges, {
    initialValue: this.form.controls.dateOfBirth.value,
  });
  /** Warning only: a date of birth under one year is allowed (babies) but often a typo. */
  readonly recentBirthDate = computed(() => isRecentBirthDate(this.dateOfBirthValue()));
  readonly birthAgeLabel = computed(() => patientAgeLabel(this.dateOfBirthValue()));

  constructor() {
    afterNextRender(() => {
      const prefill = prefillFromSearch(this.prefill());
      this.form.patchValue(prefill);
      if (prefill.phone) this.form.controls.phone.markAsDirty();
      this.lastNameInput()?.nativeElement.focus();
    });
  }

  showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  setApproximate(value: boolean): void {
    this.form.controls.approximate.setValue(value);
    this.duplicateCandidates.set([]);
    this.pendingRequest.set(null);
  }

  submit(): void {
    if (this.saving()) return;
    this.submitError.set(null);
    this.phoneConflictId.set(null);
    this.duplicateCandidates.set([]);
    const request = this.buildRequest();
    if (request === null) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.findDuplicateCandidates(request).subscribe({
      next: (candidates) => {
        this.saving.set(false);
        if (candidates.length > 0) {
          this.pendingRequest.set(request);
          this.duplicateCandidates.set(candidates);
          return;
        }
        this.create(request);
      },
      error: () => {
        this.saving.set(false);
        this.submitError.set(
          'La vérification des doublons est indisponible. Aucun patient n’a été créé.',
        );
      },
    });
  }

  createAnyway(): void {
    const request = this.pendingRequest();
    if (request === null) return;
    this.duplicateCandidates.set([]);
    this.create(request);
  }

  editDetails(): void {
    this.duplicateCandidates.set([]);
    this.pendingRequest.set(null);
  }

  candidateLabel(candidate: PracticePatientDuplicateCandidateDto): string {
    const birth = candidate.dateOfBirth
      ? formatDate(candidate.dateOfBirth)
      : candidate.approximateAgeYears !== null
        ? `environ ${candidate.approximateAgeYears} ans`
        : null;
    return [`${candidate.firstName} ${candidate.lastName}`.trim(), birth, candidate.phone]
      .filter(Boolean)
      .join(' · ');
  }

  candidateReasons(candidate: PracticePatientDuplicateCandidateDto): string {
    const labels: Record<string, string> = {
      SAME_PHONE: 'même téléphone',
      SAME_PRACTICE_IDENTIFIER: 'même identifiant de pratique',
      SAME_NAME_AND_BIRTH: 'même nom et naissance',
    };
    return candidate.matchReasons.map((reason) => labels[reason] ?? '').filter(Boolean).join(', ');
  }

  onEscape(event: Event): void {
    event.stopPropagation();
    this.cancelled.emit();
  }

  private create(request: CreatePracticePatientRequestDto): void {
    const payload = JSON.stringify(request);
    if (this.createCommand?.payload !== payload) {
      this.createCommand = { payload, idempotencyKey: newIdempotencyKey() };
    }
    this.saving.set(true);
    this.api.createPatient(request, this.createCommand.idempotencyKey).subscribe({
      next: (patient) => {
        this.saving.set(false);
        this.created.emit(patient);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409) {
          const existing = this.api.duplicateOf(error)?.existingPatientId ?? null;
          if (existing) {
            this.phoneConflictId.set(existing);
            return;
          }
        }
        this.submitError.set('Le patient n’a pas pu être créé. Réessayez.');
      },
    });
  }

  private buildRequest(): CreatePracticePatientRequestDto | null {
    const value = this.form.getRawValue();
    const approximate = value.approximate;
    const birthControl = approximate
      ? this.form.controls.approximateAgeYears
      : this.form.controls.dateOfBirth;
    birthControl.setErrors(null);
    if (this.form.controls.lastName.invalid || this.form.controls.firstName.invalid) return null;
    if (this.form.controls.sex.invalid || value.sex === '') return null;
    if (this.form.controls.phone.invalid || this.form.controls.practiceIdentifier.invalid) {
      if (this.form.controls.practiceIdentifier.invalid) this.moreOptions.set(true);
      return null;
    }
    let request: CreatePracticePatientRequestDto = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      sex: value.sex,
    };
    if (approximate) {
      const age = value.approximateAgeYears;
      if (age === null || !Number.isInteger(Number(age)) || age < 0 || age > 130) {
        birthControl.setErrors({ invalidAge: true });
        return null;
      }
      request = { ...request, approximateAgeYears: Number(age) };
    } else {
      if (!value.dateOfBirth || value.dateOfBirth > this.today) {
        birthControl.setErrors({ required: true });
        return null;
      }
      request = { ...request, dateOfBirth: value.dateOfBirth };
    }
    const phone = value.phone.trim();
    if (phone) request = { ...request, phone };
    const practiceIdentifier = value.practiceIdentifier.trim();
    if (practiceIdentifier) request = { ...request, practiceIdentifier };
    return request;
  }
}

function newIdempotencyKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function todayDateValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
