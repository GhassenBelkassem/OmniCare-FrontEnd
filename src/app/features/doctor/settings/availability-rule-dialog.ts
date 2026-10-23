import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';

import { OcButton, OcTimeField } from '../../../shared/ui';
import { AvailabilityRuleDto, DayOfWeekDto } from '../appointment-api.models';

export const WEEKDAYS: readonly {
  readonly value: DayOfWeekDto;
  readonly label: string;
}[] = [
  { value: 'MONDAY', label: 'Lundi' },
  { value: 'TUESDAY', label: 'Mardi' },
  { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY', label: 'Jeudi' },
  { value: 'FRIDAY', label: 'Vendredi' },
  { value: 'SATURDAY', label: 'Samedi' },
  { value: 'SUNDAY', label: 'Dimanche' },
];

export const WEEKDAY_LABELS: Readonly<Record<DayOfWeekDto, string>> = Object.fromEntries(
  WEEKDAYS.map((day) => [day.value, day.label]),
) as Readonly<Record<DayOfWeekDto, string>>;

export function scheduleWindowValidator(control: AbstractControl): ValidationErrors | null {
  const start = control.get('startTime')?.value as string | null;
  const end = control.get('endTime')?.value as string | null;
  const pauseStart = control.get('pauseStart')?.value as string | null;
  const pauseEnd = control.get('pauseEnd')?.value as string | null;
  const errors: Record<string, boolean> = {};

  if (start && end && start >= end) errors['workingWindowOrder'] = true;
  if (Boolean(pauseStart) !== Boolean(pauseEnd)) errors['pausePair'] = true;
  if (pauseStart && pauseEnd) {
    if (pauseStart >= pauseEnd) errors['pauseOrder'] = true;
    if (start && end && (pauseStart <= start || pauseEnd >= end)) {
      errors['pauseOutsideWindow'] = true;
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export function supportedSlotDurationValidator(control: AbstractControl): ValidationErrors | null {
  return [15, 20, 30, 45, 60].includes(Number(control.value))
    ? null
    : { unsupportedSlotDuration: true };
}

@Component({
  selector: 'app-availability-rule-dialog',
  imports: [ReactiveFormsModule, NzModalModule, OcButton, OcTimeField],
  templateUrl: './availability-rule-dialog.html',
  styleUrl: './availability-rule-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilityRuleDialog {
  readonly open = input.required<boolean>();
  readonly rule = input<AvailabilityRuleDto | null>(null);
  readonly day = input.required<DayOfWeekDto>();
  readonly contextLabel = input('Planning du médecin — tous les cabinets');
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);

  readonly openChange = output<boolean>();
  readonly saved = output<AvailabilityRuleDto>();

  readonly form = new FormGroup(
    {
      startTime: new FormControl('09:00', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      endTime: new FormControl('17:00', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      pauseStart: new FormControl<string | null>(null),
      pauseEnd: new FormControl<string | null>(null),
      slotDurationMinutes: new FormControl(30, {
        nonNullable: true,
        validators: [supportedSlotDurationValidator],
      }),
    },
    { validators: scheduleWindowValidator },
  );

  dialogTitle(): string {
    return `Modifier les horaires du ${WEEKDAY_LABELS[this.day()].toLowerCase()}`;
  }

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const rule = this.rule();
      this.form.reset({
        startTime: rule?.startTime.substring(0, 5) ?? '09:00',
        endTime: rule?.endTime.substring(0, 5) ?? '17:00',
        pauseStart: rule?.pauseStart?.substring(0, 5) ?? null,
        pauseEnd: rule?.pauseEnd?.substring(0, 5) ?? null,
        slotDurationMinutes: rule?.slotDurationMinutes ?? 30,
      });
    });
  }

  onSave(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    this.saved.emit({
      id: this.rule()?.id,
      dayOfWeek: this.day(),
      startTime: value.startTime,
      endTime: value.endTime,
      pauseStart: value.pauseStart || null,
      pauseEnd: value.pauseEnd || null,
      slotDurationMinutes: value.slotDurationMinutes,
      active: true,
    });
  }

  close(): void {
    if (!this.saving()) this.openChange.emit(false);
  }
}
