import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { OcRadioGroup } from './oc-radio-group';

describe('OcRadioGroup', () => {
  let fixture: ComponentFixture<OcRadioGroup>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OcRadioGroup] });
    fixture = TestBed.createComponent(OcRadioGroup);
    fixture.componentRef.setInput('name', 'coverage-cnam');
    fixture.componentRef.setInput('labelledBy', 'coverage-cnam-label');
    fixture.componentRef.setInput('options', [
      { value: 'NOT_DECLARED', label: 'Non renseigné' },
      { value: 'ACCEPTED', label: 'Accepté' },
      { value: 'NOT_ACCEPTED', label: 'Non accepté' },
    ]);
    fixture.detectChanges();
  });

  it('renders a labelled radiogroup with one native radio per option', () => {
    const root = fixture.nativeElement as HTMLElement;
    const group = root.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-labelledby')).toBe('coverage-cnam-label');
    expect(group?.querySelectorAll('input[type="radio"]')).toHaveLength(3);
  });
});
