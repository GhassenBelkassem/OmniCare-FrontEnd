import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ClinicalRecordStore } from '../clinical-record.store';
import { EMPTY_CLINICAL_RECORD, type ClinicalRecordPayload } from '../clinical-record.models';
import { ClinicalAuthoring } from './clinical-authoring';

const ID = '11111111-1111-4111-8111-111111111111';

describe('ClinicalAuthoring fast consultation workflow', () => {
  let fixture: ComponentFixture<ClinicalAuthoring>;
  let draft: ReturnType<typeof signal<ClinicalRecordPayload>>;

  beforeEach(() => {
    draft = signal({
      ...EMPTY_CLINICAL_RECORD,
      history: { ...EMPTY_CLINICAL_RECORD.history, presentIllness: 'Preserved history' },
      assessment: 'Preserved optional assessment',
    });
    const store = {
      attach: vi.fn(), clear: vi.fn(), refresh: vi.fn(), save: vi.fn(),
      authoritative: signal({ clinicalRecordVersion: 3, schemaVersion: 3, clinicalRecord: draft() }),
      draft,
      loading: signal(false), saving: signal(false), failure: signal<string | null>(null),
      fieldErrors: signal<Readonly<Record<string, string>>>({}), conflict: signal(false),
      newerVersionAvailable: signal(false), dirty: signal(true),
      setDraft: (value: ClinicalRecordPayload) => draft.set(value),
    };
    TestBed.configureTestingModule({
      imports: [ClinicalAuthoring],
      providers: [{ provide: ClinicalRecordStore, useValue: store }],
    });
    fixture = TestBed.createComponent(ClinicalAuthoring);
    fixture.componentRef.setInput('consultationId', ID);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows decision-first fields without manual diagnosis system or code inputs', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Diagnostic / conclusion');
    expect(text).toContain('Aucun médicament');
    expect(text).toContain('Suivi');
    expect(text).not.toContain('Système du diagnostic');
    expect(text).not.toContain('Code du diagnostic');
    expect((fixture.nativeElement.querySelector('details') as HTMLDetailsElement).open).toBe(false);
  });

  it('creates a LOCAL conclusion and preserves hidden advanced fields', () => {
    const input = fixture.nativeElement.querySelector('#clinical-diagnosis-label') as HTMLInputElement;
    input.value = 'Free-text conclusion';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(draft().diagnoses).toEqual([{ system: 'LOCAL', code: '', label: 'Free-text conclusion', status: 'PROVISIONAL' }]);
    expect(draft().history.presentIllness).toBe('Preserved history');
    expect(draft().assessment).toBe('Preserved optional assessment');
  });

  it('uses explicit medication choices and routes optional actions', () => {
    const emitted = vi.fn();
    fixture.componentInstance.actionRequested.subscribe(emitted);
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    (buttons.find((button) => button.nativeElement.textContent.trim() === 'Aucun médicament')!.nativeElement as HTMLButtonElement).click();
    (buttons.find((button) => button.nativeElement.textContent.trim() === 'Analyses')!.nativeElement as HTMLButtonElement).click();

    expect(draft().medicationDecision).toBe('NO_MEDICATION');
    expect(emitted).toHaveBeenCalledWith('lab');
  });
});
