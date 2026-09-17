import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';

import { OcButton } from '../../../shared/ui';
import { AvailabilityRuleDto, DayOfWeekDto } from '../../doctor/appointment-api.models';

const DAYS: { value: DayOfWeekDto; label: string }[] = [
  { value: 'MONDAY', label: 'Lundi' },
  { value: 'TUESDAY', label: 'Mardi' },
  { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY', label: 'Jeudi' },
  { value: 'FRIDAY', label: 'Vendredi' },
  { value: 'SATURDAY', label: 'Samedi' },
  { value: 'SUNDAY', label: 'Dimanche' },
];

@Component({
  selector: 'app-availability-rule-dialog',
  imports: [FormsModule, NzModalModule, NzSelectModule, NzInputModule, NzFormModule, OcButton],
  templateUrl: './availability-rule-dialog.html',
  styleUrl: './availability-rule-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilityRuleDialog {
  readonly days = DAYS;

  @Input({ required: true }) open = false;
  @Input() rule: AvailabilityRuleDto | null = null;

  readonly openChange = output<boolean>();
  readonly saved = output<AvailabilityRuleDto>();

  readonly dayOfWeek = signal<DayOfWeekDto>('MONDAY');
  readonly startTime = signal('09:00');
  readonly endTime = signal('17:00');
  readonly pauseStart = signal<string | null>(null);
  readonly pauseEnd = signal<string | null>(null);
  readonly slotDuration = signal(30);
  readonly active = signal(true);

  ngOnChanges(): void {
    if (this.rule) {
      this.dayOfWeek.set(this.rule.dayOfWeek);
      this.startTime.set(this.rule.startTime);
      this.endTime.set(this.rule.endTime);
      this.pauseStart.set(this.rule.pauseStart);
      this.pauseEnd.set(this.rule.pauseEnd);
      this.slotDuration.set(this.rule.slotDurationMinutes);
      this.active.set(this.rule.active);
    } else {
      this.dayOfWeek.set('MONDAY');
      this.startTime.set('09:00');
      this.endTime.set('17:00');
      this.pauseStart.set(null);
      this.pauseEnd.set(null);
      this.slotDuration.set(30);
      this.active.set(true);
    }
  }

  onSave(): void {
    const dto: AvailabilityRuleDto = {
      id: this.rule?.id,
      dayOfWeek: this.dayOfWeek(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      pauseStart: this.pauseStart(),
      pauseEnd: this.pauseEnd(),
      slotDurationMinutes: this.slotDuration(),
      active: this.active(),
    };
    this.saved.emit(dto);
    this.close();
  }

  close(): void {
    this.openChange.emit(false);
  }
}
