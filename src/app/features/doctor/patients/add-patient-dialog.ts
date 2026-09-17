import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  NonNullableFormBuilder,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzAlertModule } from 'ng-zorro-antd/alert';

import { OcButton } from '../../../shared/ui';
import {
  CreatePracticePatientRequestDto,
  PracticePatientDto,
  PracticePatientSexDto,
} from '../practice-patient-api.models';
import { PracticePatientApiService } from '../practice-patient-api.service';

const PHONE_PATTERN = /^[+0-9 ()./-]{6,32}$/;
const SEX_VALUES = new Set<PracticePatientSexDto>(['M', 'F', 'autre']);

@Component({
  selector: 'app-add-patient-dialog',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    NzInputModule,
    NzFormModule,
    NzAlertModule,
    OcButton,
  ],
  templateUrl: './add-patient-dialog.html',
  styleUrl: './add-patient-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPatientDialog {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(PracticePatientApiService);

  readonly open = input(false);
  readonly openChange = output<boolean>();
  readonly created = output<PracticePatientDto>();
  readonly duplicate = output<string>();

  readonly saving = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly duplicateId = signal<string | null>(null);

  readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(128)]],
    lastName: ['', [Validators.required, Validators.maxLength(128)]],
    dateOfBirth: ['', [Validators.required]],
    sex: this.fb.control<PracticePatientSexDto | ''>('', Validators.required),
    phone: [
      '',
      [Validators.required, Validators.maxLength(32), Validators.pattern(PHONE_PATTERN)],
    ],
    email: ['', [Validators.maxLength(255), Validators.email]],
    address: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({ sex: '' });
        this.submitError.set(null);
        this.duplicateId.set(null);
        this.saving.set(false);
      }
    });
  }

  onSubmit(): void {
    this.submitError.set(null);
    this.duplicateId.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const sex = this.normalizeSex(this.form.controls.sex.value);
    if (!sex) {
      this.form.controls.sex.setErrors({ invalidSex: true });
      this.form.controls.sex.markAsTouched();
      return;
    }
    let request: CreatePracticePatientRequestDto = {
      firstName: this.form.controls.firstName.value.trim(),
      lastName: this.form.controls.lastName.value.trim(),
      dateOfBirth: this.form.controls.dateOfBirth.value,
      sex,
      phone: this.form.controls.phone.value.trim(),
    };
    const email = this.form.controls.email.value.trim();
    if (email) {
      request = { ...request, email };
    }
    const address = this.form.controls.address.value.trim();
    if (address) {
      request = { ...request, address };
    }
    this.saving.set(true);
    this.api.createPatient(request).subscribe({
      next: (patient) => {
        this.saving.set(false);
        this.created.emit(patient);
        this.close();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.duplicateId.set(this.api.duplicateOf(error)?.existingPatientId ?? null);
          return;
        }
        this.submitError.set("Impossible d'enregistrer le patient. Veuillez réessayer.");
      },
    });
  }

  onViewDuplicate(): void {
    const existingPatientId = this.duplicateId();
    this.close();
    if (existingPatientId) {
      this.duplicate.emit(existingPatientId);
    }
  }

  close(): void {
    this.openChange.emit(false);
  }

  private normalizeSex(value: string): PracticePatientSexDto | null {
    const normalized = value.trim().toLowerCase();
    const sex = normalized === 'm' || normalized === 'f'
      ? normalized.toUpperCase()
      : normalized;
    return SEX_VALUES.has(sex as PracticePatientSexDto)
      ? (sex as PracticePatientSexDto)
      : null;
  }
}
