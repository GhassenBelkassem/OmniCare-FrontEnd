import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OcSheet } from './oc-sheet';

@Component({
  imports: [OcSheet],
  template: `<oc-sheet [open]="open()" title="Task preview" description="Read-only details" [submitting]="submitting()" [hasFooter]="hasFooter()" (dismissed)="dismissals.update(value => value + 1)">
    <p>Projected task information</p><button ocSheetFooter type="button">Close</button>
  </oc-sheet>`,
})
class SheetHarness {
  readonly open = signal(false);
  readonly submitting = signal(false);
  readonly hasFooter = signal(true);
  readonly dismissals = signal(0);
}

describe('OcSheet', () => {
  let fixture: ComponentFixture<SheetHarness>;
  let harness: SheetHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SheetHarness] });
    fixture = TestBed.createComponent(SheetHarness);
    harness = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('keeps controlled sheet content out of the overlay while closed', () => {
    expect(overlayRoot().textContent).not.toContain('Projected task information');
  });

  it('renders a labelled projected sheet and its declared footer while open', async () => {
    harness.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlayRoot().textContent).toContain('Task preview');
    expect(overlayRoot().textContent).toContain('Read-only details');
    expect(overlayRoot().querySelector('.oc-sheet__footer')?.textContent).toContain('Close');
  });

  it('does not dismiss while submitting', () => {
    harness.submitting.set(true);
    fixture.detectChanges();
    const sheet = fixture.debugElement.query((node) => node.componentInstance instanceof OcSheet)
      .componentInstance as OcSheet;
    (sheet as any).dismiss();
    expect(harness.dismissals()).toBe(0);
  });

  function overlayRoot(): ParentNode {
    return document.querySelector('.cdk-overlay-container') ?? fixture.nativeElement;
  }
});
