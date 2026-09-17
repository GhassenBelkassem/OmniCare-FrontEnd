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

  it('maps established and expanded variants without exposing NG-ZORRO internals', () => {
    const fixture = TestBed.createComponent(OcButton);
    fixture.componentRef.setInput('variant', 'quiet');
    fixture.componentRef.setInput('size', 'large');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.classList.contains('oc-button--ghost')).toBe(true);
    expect(button.classList.contains('oc-button--large')).toBe(true);
    expect(button.hasAttribute('nz-button')).toBe(false);
  });

  it('applies an accessible name to an icon-only action', () => {
    const fixture = TestBed.createComponent(OcButton);
    fixture.componentRef.setInput('iconOnly', true);
    fixture.componentRef.setInput('ariaLabel', 'Close filters');
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).getAttribute('aria-label')).toBe('Close filters');
  });
});
