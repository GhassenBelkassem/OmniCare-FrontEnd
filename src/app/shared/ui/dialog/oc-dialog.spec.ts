import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OcDialog } from './oc-dialog';

@Component({
  imports: [OcDialog],
  template: `
    <oc-dialog
      [open]="open()"
      title="Confirm assignment"
      description="Review the selected operational assignment."
      [intent]="intent()"
      [submitting]="submitting()"
      [hasFooter]="hasFooter()"
      (dismissed)="dismissals.update((count) => count + 1)"
    >
      <p data-testid="projected-content">Projected operational content</p>
      <button ocDialogFooter type="button">Cancel</button>
      <button ocDialogFooter type="button">Confirm</button>
    </oc-dialog>
  `,
})
class DialogHarness {
  readonly open = signal(false);
  readonly submitting = signal(false);
  readonly intent = signal<'standard' | 'destructive'>('standard');
  readonly hasFooter = signal(true);
  readonly dismissals = signal(0);
}

describe('OcDialog', () => {
  let fixture: ComponentFixture<DialogHarness>;
  let harness: DialogHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DialogHarness] });
    fixture = TestBed.createComponent(DialogHarness);
    harness = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('keeps modal content out of the DOM while closed', () => {
    expect(overlayText()).not.toContain('Projected operational content');
  });

  it('renders title, description, projected content, and accessible relationships while open', async () => {
    harness.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = overlayRoot().querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Confirm assignment');
    expect(dialog.textContent).toContain('Review the selected operational assignment.');
    expect(dialog.textContent).toContain('Projected operational content');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('emits dismissal when the controlled dialog is dismissible', () => {
    const dialog = fixture.debugElement.query((node) => node.componentInstance instanceof OcDialog)
      .componentInstance as OcDialog;
    (dialog as any).requestDismiss();
    expect(harness.dismissals()).toBe(1);
  });

  it('does not emit dismissal while submitting and exposes destructive intent', async () => {
    harness.open.set(true);
    harness.submitting.set(true);
    harness.intent.set('destructive');
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = fixture.debugElement.query((node) => node.componentInstance instanceof OcDialog)
      .componentInstance as OcDialog;
    (dialog as any).requestDismiss();
    expect(harness.dismissals()).toBe(0);
    expect(overlayRoot().querySelector('[role="dialog"]')).toBeTruthy();
    expect(overlayRoot().querySelector('.oc-dialog--destructive')).toBeTruthy();
    expect(overlayRoot().textContent).toContain('Destructive action');
  });

  it('renders footer actions only when a footer is declared', async () => {
    harness.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlayRoot().querySelector('.oc-dialog__footer')?.textContent).toContain('Confirm');

    harness.hasFooter.set(false);
    fixture.detectChanges();
    expect(overlayRoot().querySelector('.oc-dialog__footer')).toBeNull();
  });

  it('can be created while closed without requiring browser-only work', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  function overlayRoot(): ParentNode {
    return document.querySelector('.cdk-overlay-container') ?? fixture.nativeElement;
  }

  function overlayText(): string {
    return overlayRoot().textContent ?? '';
  }
});
