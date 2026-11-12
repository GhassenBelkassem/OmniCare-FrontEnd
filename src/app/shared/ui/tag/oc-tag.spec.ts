import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { OcTag } from './oc-tag';

describe('OcTag', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('is the white bordered value tag by default and takes one tone per kind of information', () => {
    const fixture = TestBed.createComponent(OcTag);
    fixture.detectChanges();
    const tag = (): Element => (fixture.nativeElement as HTMLElement).querySelector('nz-tag')!;
    expect(tag().classList).toContain('oc-tag--value');
    fixture.componentRef.setInput('tone', 'allergy');
    fixture.detectChanges();
    expect(tag().classList).toContain('oc-tag--allergy');
    expect(tag().classList).toContain('ant-tag');
  });
});
