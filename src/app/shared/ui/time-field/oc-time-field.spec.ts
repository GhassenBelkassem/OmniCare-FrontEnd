import { Component } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import enGb from '@angular/common/locales/en-GB';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NzTimePickerComponent } from 'ng-zorro-antd/time-picker';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { describe, expect, it, vi } from 'vitest';

import {
  OC_TIME_FORMAT,
  OC_TIME_MINUTE_STEP,
  OcTimeField,
  timeValueToUiDate,
  uiDateToTimeValue,
} from './oc-time-field';

registerLocaleData(enGb);

@Component({
  imports: [ReactiveFormsModule, OcTimeField],
  template: `
    <label id="time-label" for="time-control">Heure</label>
    <oc-time-field
      controlId="time-control"
      ariaLabelledBy="time-label"
      ariaDescribedBy="time-error"
      [invalid]="control.invalid && control.touched"
      [formControl]="control"
    />
    <span id="time-error">Heure invalide</span>
  `,
})
class TimeFieldHarness {
  readonly control = new FormControl<string | null>(null);
}

describe('OcTimeField', () => {
  let fixture: ComponentFixture<TimeFieldHarness>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TimeFieldHarness],
      providers: [provideNzI18n(en_GB)],
    });
    fixture = TestBed.createComponent(TimeFieldHarness);
    fixture.detectChanges();
  });

  it.each(['09:00', '17:45'])(
    'writes %s into the UI without changing the domain value',
    (value) => {
      fixture.componentInstance.control.setValue(value);
      fixture.detectChanges();

      expect(picker().value?.getHours()).toBe(Number(value.slice(0, 2)));
      expect(picker().value?.getMinutes()).toBe(Number(value.slice(3, 5)));
      expect(fixture.componentInstance.control.value).toBe(value);
    },
  );

  it('emits an HH:mm string from a UI Date and strips seconds', () => {
    picker().emitValue(new Date(2000, 0, 1, 13, 30, 47));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('13:30');
  });

  it('clears the UI for null', () => {
    fixture.componentInstance.control.setValue('09:00');
    fixture.componentInstance.control.setValue(null);
    fixture.detectChanges();

    expect(picker().value).toBeNull();
  });

  it('propagates the disabled state', () => {
    fixture.componentInstance.control.disable();
    fixture.detectChanges();

    expect(picker().nzDisabled).toBe(true);
    expect(picker().inputRef.nativeElement.disabled).toBe(true);
  });

  it('propagates touched state and accessible relationships from the picker input', () => {
    const touched = vi.fn();
    fixture.componentInstance.control.events.subscribe((event) => {
      if ('touched' in event && event.touched) touched();
    });

    picker().inputRef.nativeElement.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.componentInstance.control.touched).toBe(true);
    expect(touched).toHaveBeenCalled();
    expect(picker().inputRef.nativeElement.getAttribute('aria-labelledby')).toBe('time-label');
    expect(picker().inputRef.nativeElement.getAttribute('aria-describedby')).toBe('time-error');
  });

  it('rejects malformed domain input without creating a fake time', () => {
    fixture.componentInstance.control.setValue('25:61');
    fixture.detectChanges();

    expect(fixture.componentInstance.control.hasError('timeFormat')).toBe(true);
    expect(picker().value).toBeNull();
    expect(timeValueToUiDate('9:00')).toBeNull();
  });

  it('uses an hour-and-minute-only 24-hour picker with a five-minute step', () => {
    expect(picker().nzFormat).toBe(OC_TIME_FORMAT);
    expect(picker().nzUse12Hours).toBe(false);
    expect(picker().nzMinuteStep).toBe(OC_TIME_MINUTE_STEP);
    expect(uiDateToTimeValue(new Date(2000, 0, 1, 17, 45, 59))).toBe('17:45');
  });

  function picker(): NzTimePickerComponent {
    return fixture.debugElement.query(By.directive(NzTimePickerComponent)).componentInstance;
  }
});
