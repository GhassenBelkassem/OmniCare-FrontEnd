import { registerLocaleData } from '@angular/common';
import enGb from '@angular/common/locales/en-GB';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { describe, expect, it, vi } from 'vitest';

import { OcTimeField } from '../../../shared/ui';
import { AvailabilityRuleDto } from '../appointment-api.models';
import { BulkScheduleEditor, mergeScheduleRules, removeScheduleDay } from './bulk-schedule-editor';

registerLocaleData(enGb);

const MONDAY: AvailabilityRuleDto = {
  id: 'monday',
  dayOfWeek: 'MONDAY',
  active: true,
  startTime: '08:00',
  endTime: '12:00',
  pauseStart: null,
  pauseEnd: null,
  slotDurationMinutes: 30,
};

describe('BulkScheduleEditor', () => {
  it('requires at least one selected day and exposes a dynamic CTA', () => {
    const { component } = createEditor();
    const saved = vi.fn();
    component.saved.subscribe(saved);

    component.submit();
    expect(component.form.controls.days.hasError('requiredDay')).toBe(true);
    expect(saved).not.toHaveBeenCalled();

    component.setDay('MONDAY', true);
    expect(component.primaryLabel()).toBe('Appliquer à 1 jour');
  });

  it('emits Monday through Friday as five valid schedule replacements', () => {
    const { component } = createEditor(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
    const saved = vi.fn();
    component.saved.subscribe(saved);

    component.submit();

    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({
        days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        rule: expect.objectContaining({ startTime: '09:00', endTime: '17:00' }),
      }),
    );
    expect(component.primaryLabel()).toBe('Appliquer à 5 jours');
  });

  it('preserves input after a save failure', () => {
    const { component, fixture } = createEditor(['WEDNESDAY'], 'Impossible d’enregistrer.');
    component.form.patchValue({ startTime: '10:00', endTime: '18:00' });
    fixture.detectChanges();

    expect(component.form.getRawValue()).toMatchObject({ startTime: '10:00', endTime: '18:00' });
    expect(component.selectedDays()).toEqual(['WEDNESDAY']);
    expect(component.open()).toBe(true);
  });

  it('uses the shared 24-hour field for working and pause times', () => {
    const { component, fixture } = createEditor(['MONDAY']);

    expect(fixture.debugElement.queryAll(By.directive(OcTimeField))).toHaveLength(2);
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('sourceRule', {
      ...MONDAY,
      startTime: '09:00',
      endTime: '17:00',
      pauseStart: '13:00',
      pauseEnd: '14:00',
    });
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const fields = fixture.debugElement.queryAll(By.directive(OcTimeField));
    expect(fields).toHaveLength(4);
    expect(component.form.getRawValue()).toMatchObject({
      startTime: '09:00',
      endTime: '17:00',
      pauseStart: '13:00',
      pauseEnd: '14:00',
    });
  });
});

describe('weekly schedule transformations', () => {
  it('replaces selected days, preserves unselected days, and deduplicates output', () => {
    const tuesday = { ...MONDAY, id: 'tuesday', dayOfWeek: 'TUESDAY' as const };
    const duplicateTuesday = { ...tuesday, id: 'duplicate' };
    const template = { ...MONDAY, id: undefined, startTime: '09:00', endTime: '17:00' };

    const result = mergeScheduleRules(
      [MONDAY, tuesday, duplicateTuesday],
      ['MONDAY', 'WEDNESDAY', 'WEDNESDAY'],
      template,
    );

    expect(result).toHaveLength(3);
    expect(result.find((rule) => rule.dayOfWeek === 'MONDAY')).toMatchObject({
      id: 'monday',
      startTime: '09:00',
    });
    expect(result.find((rule) => rule.dayOfWeek === 'TUESDAY')).toEqual(tuesday);
    expect(result.find((rule) => rule.dayOfWeek === 'WEDNESDAY')).toMatchObject({
      id: undefined,
      startTime: '09:00',
    });
    expect(new Set(result.map((rule) => rule.dayOfWeek)).size).toBe(result.length);
  });

  it('copies a source day only to selected destinations', () => {
    const tuesday = { ...MONDAY, id: 'tuesday', dayOfWeek: 'TUESDAY' as const };
    const result = mergeScheduleRules([MONDAY, tuesday], ['WEDNESDAY'], MONDAY);

    expect(result.find((rule) => rule.dayOfWeek === 'TUESDAY')).toEqual(tuesday);
    expect(result.find((rule) => rule.dayOfWeek === 'WEDNESDAY')).toMatchObject({
      id: undefined,
      startTime: MONDAY.startTime,
      endTime: MONDAY.endTime,
      pauseStart: MONDAY.pauseStart,
      pauseEnd: MONDAY.pauseEnd,
      slotDurationMinutes: MONDAY.slotDurationMinutes,
      active: MONDAY.active,
    });
  });

  it('marks a day closed by omitting it without affecting other days', () => {
    const tuesday = { ...MONDAY, id: 'tuesday', dayOfWeek: 'TUESDAY' as const };
    expect(removeScheduleDay([MONDAY, tuesday], 'MONDAY')).toEqual([tuesday]);
  });
});

function createEditor(
  initialDays: readonly AvailabilityRuleDto['dayOfWeek'][] = [],
  saveError: string | null = null,
): { fixture: ComponentFixture<BulkScheduleEditor>; component: BulkScheduleEditor } {
  TestBed.configureTestingModule({
    imports: [BulkScheduleEditor],
    providers: [provideNzI18n(en_GB)],
  });
  const fixture = TestBed.createComponent(BulkScheduleEditor);
  fixture.componentRef.setInput('open', true);
  fixture.componentRef.setInput('initialDays', initialDays);
  fixture.componentRef.setInput('saveError', saveError);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}
