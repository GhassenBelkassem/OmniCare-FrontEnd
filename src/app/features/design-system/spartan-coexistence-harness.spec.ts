import { TestBed } from '@angular/core/testing';

import { SpartanCoexistenceHarness } from './spartan-coexistence-harness';

describe('SpartanCoexistenceHarness', () => {
  it('creates without browser-only work during initial render', () => {
    const fixture = TestBed.createComponent(SpartanCoexistenceHarness);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.oc-spartan-compat')).toBeTruthy();
  });

  it('associates its field label, hint, and validation error', () => {
    const fixture = TestBed.createComponent(SpartanCoexistenceHarness);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#spartan-compat-name') as HTMLInputElement;
    const label = fixture.nativeElement.querySelector('label[for="spartan-compat-name"]') as HTMLLabelElement;
    fixture.componentInstance.nameControl.setValue('x');
    fixture.componentInstance.nameControl.markAsTouched();
    fixture.detectChanges();

    expect(label.control).toBe(input);
    expect(input.getAttribute('aria-describedby')).toContain('spartan-compat-name-hint');
    expect(input.getAttribute('aria-describedby')).toContain('spartan-compat-name-error');
    expect(fixture.nativeElement.querySelector('#spartan-compat-name-error')).toBeTruthy();
  });

  it('renders disabled and loading button states', () => {
    const fixture = TestBed.createComponent(SpartanCoexistenceHarness);
    fixture.detectChanges();

    const loadingButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) =>
      button.textContent?.includes('Show loading state'),
    ) as HTMLButtonElement;
    loadingButton.click();
    fixture.detectChanges();

    expect(loadingButton.disabled).toBe(true);
    expect(loadingButton.textContent).toContain('Loading');
  });

  it('opens a focus-trapped dialog and restores focus after Escape', async () => {
    const fixture = TestBed.createComponent(SpartanCoexistenceHarness);
    fixture.detectChanges();

    const trigger = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) =>
      button.textContent?.includes('Open focus-safe dialog'),
    ) as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const dialogInput = document.querySelector('#spartan-compat-dialog-name') as HTMLInputElement;
    const dialog = dialogInput.closest('[role="dialog"]') as HTMLElement;
    expect(dialogInput).toBeTruthy();
    expect(document.activeElement).toBe(dialogInput);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(document.querySelector('#spartan-compat-dialog-name')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('dismisses a sheet from its close control', async () => {
    const fixture = TestBed.createComponent(SpartanCoexistenceHarness);
    fixture.detectChanges();

    const trigger = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) =>
      button.textContent?.includes('Open focus-safe sheet'),
    ) as HTMLButtonElement;
    trigger.click();
    await fixture.whenStable();

    const close = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Close sheet'),
    ) as HTMLButtonElement;
    expect(close).toBeTruthy();
    close.click();
    await fixture.whenStable();

    expect(
      Array.from(document.querySelectorAll<HTMLButtonElement>('button')).some((button) =>
        button.textContent?.includes('Close sheet'),
      ),
    ).toBe(false);
  });
});
