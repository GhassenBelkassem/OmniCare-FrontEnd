import { TestBed } from '@angular/core/testing';

import { OcButton } from './oc-button';

describe('OcButton', () => {
  it('disables the native control when disabled', () => {
    const fixture = TestBed.createComponent(OcButton);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('announces loading and prevents interaction', () => {
    const fixture = TestBed.createComponent(OcButton);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});
