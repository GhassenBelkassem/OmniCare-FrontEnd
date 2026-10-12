import { registerLocaleData } from '@angular/common';
import enGb from '@angular/common/locales/en-GB';
import { FormControl, FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { describe, expect, it } from 'vitest';

import { OcTimeField } from '../../../shared/ui';
import {
  AvailabilityRuleDialog,
  scheduleWindowValidator,
  supportedSlotDurationValidator,
} from './availability-rule-dialog';

registerLocaleData(enGb);

function form(values: {
  start: string;
  end: string;
  pauseStart?: string;
  pauseEnd?: string;
}): FormGroup {
  return new FormGroup(
    {
      startTime: new FormControl(values.start),
      endTime: new FormControl(values.end),
      pauseStart: new FormControl(values.pauseStart ?? ''),
      pauseEnd: new FormControl(values.pauseEnd ?? ''),
    },
    { validators: scheduleWindowValidator },
  );
}

describe('availability schedule validation', () => {
  it('rejects an inverted working interval', () => {
    expect(form({ start: '17:00', end: '09:00' }).hasError('workingWindowOrder')).toBe(true);
  });

  it('requires a complete pause pair inside the working interval', () => {
    expect(form({ start: '09:00', end: '17:00', pauseStart: '12:00' }).hasError('pausePair')).toBe(
      true,
    );
    expect(
      form({ start: '09:00', end: '17:00', pauseStart: '08:00', pauseEnd: '10:00' }).hasError(
        'pauseOutsideWindow',
      ),
    ).toBe(true);
  });

  it('rejects an inverted pause interval', () => {
    expect(
      form({ start: '09:00', end: '17:00', pauseStart: '14:00', pauseEnd: '13:00' }).hasError(
        'pauseOrder',
      ),
    ).toBe(true);
  });

  it('rejects a pause that is not contained by working hours', () => {
    expect(
      form({ start: '09:00', end: '17:00', pauseStart: '08:00', pauseEnd: '10:00' }).hasError(
        'pauseOutsideWindow',
      ),
    ).toBe(true);
  });

  it('accepts a complete valid rule', () => {
    expect(
      form({ start: '09:00', end: '17:00', pauseStart: '12:00', pauseEnd: '13:00' }).valid,
    ).toBe(true);
  });

  it('accepts only supported slot durations', () => {
    expect(supportedSlotDurationValidator(new FormControl(30))).toBeNull();
    expect(supportedSlotDurationValidator(new FormControl(25))).toEqual({
      unsupportedSlotDuration: true,
    });
  });

  it('uses day-specific product wording for individual editing', () => {
    TestBed.configureTestingModule({
      imports: [AvailabilityRuleDialog],
      providers: [provideNzI18n(en_GB)],
    });
    const fixture = TestBed.createComponent(AvailabilityRuleDialog);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('day', 'WEDNESDAY');
    fixture.detectChanges();

    expect(fixture.componentInstance.dialogTitle()).toBe('Modifier les horaires du mercredi');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Ajouter une règle');
    expect(fixture.debugElement.queryAll(By.directive(OcTimeField))).toHaveLength(4);
  });
});
