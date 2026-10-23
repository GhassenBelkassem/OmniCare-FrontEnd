import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { OcSkeleton } from './oc-skeleton';

describe('OcSkeleton', () => {
  let fixture: ComponentFixture<OcSkeleton>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OcSkeleton] });
    fixture = TestBed.createComponent(OcSkeleton);
  });

  it('supports the compact circular placeholder used by icon-led rows', () => {
    fixture.componentRef.setInput('variant', 'circle');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.oc-skeleton--circle'),
    ).not.toBeNull();
  });
});
