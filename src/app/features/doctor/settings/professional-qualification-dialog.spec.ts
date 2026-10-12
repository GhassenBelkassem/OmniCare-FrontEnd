import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import {
  ProfessionalQualificationDialog,
  ProfessionalQualificationSubmission,
} from './professional-qualification-dialog';

describe('ProfessionalQualificationDialog', () => {
  let fixture: ComponentFixture<ProfessionalQualificationDialog>;
  let component: ProfessionalQualificationDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProfessionalQualificationDialog] });
    fixture = TestBed.createComponent(ProfessionalQualificationDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('kind', 'education');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('requires the education qualification and institution', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.submit();
    expect(component.form.invalid).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('normalizes an education form and emits deterministic ordering', () => {
    let submission: ProfessionalQualificationSubmission | null = null;
    component.submitted.subscribe((value) => (submission = value));
    fixture.componentRef.setInput('nextDisplayOrder', 4);
    component.form.patchValue({
      primary: '  Doctorat en médecine  ',
      secondary: '  Faculté de Médecine de Tunis  ',
      tertiary: '  Cardiologie  ',
      year: '2018',
    });
    component.submit();

    expect(submission).toEqual({
      kind: 'education',
      id: null,
      revision: null,
      value: {
        institution: 'Faculté de Médecine de Tunis',
        qualification: 'Doctorat en médecine',
        fieldOfStudy: 'Cardiologie',
        completionYear: 2018,
        displayOrder: 4,
      },
    });
  });

  it('rejects a certification expiry date before its issue year', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('kind', 'certification');
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    component.form.patchValue({ primary: 'Certification', year: '2025', expiryDate: '2024-12-31' });
    component.form.updateValueAndValidity();
    expect(component.form.hasError('expiryBeforeIssue')).toBe(true);
  });
});
