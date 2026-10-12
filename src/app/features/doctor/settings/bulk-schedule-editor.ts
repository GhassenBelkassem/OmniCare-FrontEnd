import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';

import { OcButton, OcCheckbox, OcDialog, OcTimeField } from '../../../shared/ui';
import { AvailabilityRuleDto, DayOfWeekDto } from '../appointment-api.models';
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  scheduleWindowValidator,
  supportedSlotDurationValidator,
} from './availability-rule-dialog';

export { WEEKDAYS, WEEKDAY_LABELS };

export type BulkScheduleMode = 'setup' | 'edit' | 'copy';

export interface BulkScheduleChange {
  readonly days: readonly DayOfWeekDto[];
  readonly rule: AvailabilityRuleDto;
}

const DAY_ORDER = new Map(WEEKDAYS.map((day, index) => [day.value, index]));

export function mergeScheduleRules(
  current: readonly AvailabilityRuleDto[],
  selectedDays: readonly DayOfWeekDto[],
  template: AvailabilityRuleDto,
): readonly AvailabilityRuleDto[] {
  const byDay = new Map<DayOfWeekDto, AvailabilityRuleDto>();
  for (const rule of current) {
    if (!byDay.has(rule.dayOfWeek)) byDay.set(rule.dayOfWeek, rule);
  }

  for (const day of new Set(selectedDays)) {
    const existing = byDay.get(day);
    byDay.set(day, {
      ...template,
      id: existing?.id,
      doctorId: existing?.doctorId ?? template.doctorId,
      dayOfWeek: day,
    });
  }

  return [...byDay.values()].sort(
    (left, right) => (DAY_ORDER.get(left.dayOfWeek) ?? 0) - (DAY_ORDER.get(right.dayOfWeek) ?? 0),
  );
}

export function removeScheduleDay(
  current: readonly AvailabilityRuleDto[],
  day: DayOfWeekDto,
): readonly AvailabilityRuleDto[] {
  const byDay = new Map<DayOfWeekDto, AvailabilityRuleDto>();
  for (const rule of current) {
    if (rule.dayOfWeek !== day && !byDay.has(rule.dayOfWeek)) {
      byDay.set(rule.dayOfWeek, rule);
    }
  }
  return WEEKDAYS.flatMap(({ value }) => (byDay.has(value) ? [byDay.get(value)!] : []));
}

function atLeastOneDayValidator(control: AbstractControl): ValidationErrors | null {
  const values = control.value as Readonly<Record<DayOfWeekDto, boolean>>;
  return Object.values(values).some(Boolean) ? null : { requiredDay: true };
}

@Component({
  selector: 'app-bulk-schedule-editor',
  imports: [ReactiveFormsModule, OcButton, OcCheckbox, OcDialog, OcTimeField],
  templateUrl: './bulk-schedule-editor.html',
  styleUrl: './bulk-schedule-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkScheduleEditor {
  readonly open = input.required<boolean>();
  readonly mode = input<BulkScheduleMode>('setup');
  readonly initialDays = input<readonly DayOfWeekDto[]>([]);
  readonly sourceRule = input<AvailabilityRuleDto | null>(null);
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);

  readonly dismissed = output<void>();
  readonly saved = output<BulkScheduleChange>();

  readonly days = WEEKDAYS;
  readonly form = new FormGroup(
    {
      days: new FormGroup(
        {
          MONDAY: new FormControl(false, { nonNullable: true }),
          TUESDAY: new FormControl(false, { nonNullable: true }),
          WEDNESDAY: new FormControl(false, { nonNullable: true }),
          THURSDAY: new FormControl(false, { nonNullable: true }),
          FRIDAY: new FormControl(false, { nonNullable: true }),
          SATURDAY: new FormControl(false, { nonNullable: true }),
          SUNDAY: new FormControl(false, { nonNullable: true }),
        },
        { validators: atLeastOneDayValidator },
      ),
      startTime: new FormControl('09:00', { nonNullable: true }),
      endTime: new FormControl('17:00', { nonNullable: true }),
      includePause: new FormControl(false, { nonNullable: true }),
      pauseStart: new FormControl<string | null>(null),
      pauseEnd: new FormControl<string | null>(null),
      slotDurationMinutes: new FormControl(30, {
        nonNullable: true,
        validators: [supportedSlotDurationValidator],
      }),
    },
    { validators: scheduleWindowValidator },
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const source = this.sourceRule();
      const selected = new Set(this.initialDays());
      if (this.mode() === 'copy' && source) selected.delete(source.dayOfWeek);
      this.form.reset({
        days: Object.fromEntries(
          WEEKDAYS.map((day) => [day.value, selected.has(day.value)]),
        ) as Record<DayOfWeekDto, boolean>,
        startTime: source?.startTime.substring(0, 5) ?? '09:00',
        endTime: source?.endTime.substring(0, 5) ?? '17:00',
        includePause: Boolean(source?.pauseStart && source.pauseEnd),
        pauseStart: source?.pauseStart?.substring(0, 5) ?? null,
        pauseEnd: source?.pauseEnd?.substring(0, 5) ?? null,
        slotDurationMinutes: source?.slotDurationMinutes ?? 30,
      });
    });
  }

  title(): string {
    if (this.mode() === 'copy') {
      const source = this.sourceRule();
      return `Copier les horaires du ${source ? WEEKDAY_LABELS[source.dayOfWeek].toLowerCase() : 'jour'}`;
    }
    return this.mode() === 'setup'
      ? 'Configurez vos horaires habituels'
      : 'Modifier plusieurs jours';
  }

  description(): string {
    return this.mode() === 'edit'
      ? 'Les horaires des jours sélectionnés seront remplacés. Les autres jours resteront inchangés.'
      : 'Les rendez-vous existants restent inchangés.';
  }

  dayControl(day: DayOfWeekDto): FormControl<boolean> {
    return this.form.controls.days.controls[day];
  }

  setDay(day: DayOfWeekDto, selected: boolean): void {
    if (this.saving() || this.copySourceIs(day)) return;
    this.dayControl(day).setValue(selected);
    this.dayControl(day).markAsTouched();
    this.form.controls.days.updateValueAndValidity();
  }

  copySourceIs(day: DayOfWeekDto): boolean {
    return this.mode() === 'copy' && this.sourceRule()?.dayOfWeek === day;
  }

  togglePause(includePause: boolean): void {
    this.form.controls.includePause.setValue(includePause);
    if (!includePause) {
      this.form.patchValue({ pauseStart: null, pauseEnd: null });
    } else if (!this.form.controls.pauseStart.value && !this.form.controls.pauseEnd.value) {
      this.form.patchValue({ pauseStart: '13:00', pauseEnd: '14:00' });
    }
    this.form.updateValueAndValidity();
  }

  selectedDays(): readonly DayOfWeekDto[] {
    const values = this.form.controls.days.getRawValue();
    return WEEKDAYS.filter((day) => values[day.value]).map((day) => day.value);
  }

  primaryLabel(): string {
    const count = this.selectedDays().length;
    if (this.mode() === 'copy') return `Copier vers ${count} ${count === 1 ? 'jour' : 'jours'}`;
    return `Appliquer à ${count} ${count === 1 ? 'jour' : 'jours'}`;
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.form.controls.days.updateValueAndValidity();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const source = this.sourceRule();
    this.saved.emit({
      days: this.selectedDays(),
      rule: {
        dayOfWeek: source?.dayOfWeek ?? this.selectedDays()[0],
        active: this.mode() === 'copy' ? (source?.active ?? true) : true,
        startTime: value.startTime,
        endTime: value.endTime,
        pauseStart: value.includePause ? value.pauseStart || null : null,
        pauseEnd: value.includePause ? value.pauseEnd || null : null,
        slotDurationMinutes: value.slotDurationMinutes,
      },
    });
  }
}
