import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { OcStatusBadge } from './oc-status-badge';

describe('OcStatusBadge', () => {
  let fixture: ComponentFixture<OcStatusBadge>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OcStatusBadge] });
    fixture = TestBed.createComponent(OcStatusBadge);
  });

  it('renders a compact semantic pill with a decorative status dot', () => {
    fixture.componentRef.setInput('status', 'confirmed');
    fixture.componentRef.setInput('customLabel', 'Cabinet principal');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.oc-status--success')?.textContent).toContain('Cabinet principal');
    expect(root.querySelector('.oc-status__dot')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('offers an opt-in strong treatment without changing the default', () => {
    fixture.componentRef.setInput('status', 'pending');
    fixture.componentRef.setInput('emphasis', 'strong');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.oc-status--strong')).toBeTruthy();
  });

  it.each([
    ['draft', 'Draft'],
    ['pending', 'Pending'],
    ['in-progress', 'In progress'],
    ['confirmed', 'Confirmed'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['blocked', 'Blocked'],
    ['requires-attention', 'Requires attention'],
    ['critical', 'Critical'],
    ['expired', 'Expired'],
  ] as const)('renders the visible label for %s', (status, expectedLabel) => {
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.oc-status__label') as HTMLElement;
    expect(label.textContent?.trim()).toBe(expectedLabel);
  });

  it('falls back to the semantic status label when a custom label is empty', () => {
    fixture.componentRef.setInput('status', 'pending');
    fixture.componentRef.setInput('customLabel', '   ');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.oc-status') as HTMLElement;
    expect(badge.querySelector('.oc-status__label')?.textContent?.trim()).toBe('Pending');
    expect(badge.textContent?.trim()).not.toBe('');
  });
});
