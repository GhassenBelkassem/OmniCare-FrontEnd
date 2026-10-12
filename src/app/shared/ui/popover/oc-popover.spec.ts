import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OcPopover } from './oc-popover';

@Component({
  imports: [OcPopover],
  template: `
    <oc-popover
      [open]="open()"
      label="Notifications"
      triggerLabel="Open notifications"
      triggerAppearance="icon"
      (openChange)="open.set($event)"
    >
      <span ocPopoverTrigger>Bell</span>
      <button type="button" data-testid="notification-action">Review notification</button>
    </oc-popover>
  `,
})
class PopoverHarness {
  readonly open = signal(false);
}

describe('OcPopover', () => {
  let fixture: ComponentFixture<PopoverHarness>;
  let harness: PopoverHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [PopoverHarness] });
    fixture = TestBed.createComponent(PopoverHarness);
    harness = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('opens from its labelled trigger and exposes a labelled non-modal dialog', async () => {
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = overlayRoot().querySelector('[role="dialog"]') as HTMLElement;
    expect(harness.open()).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Notifications');
    expect(dialog.textContent).toContain('Review notification');
  });

  it('moves focus into the disclosure and restores it after Escape', async () => {
    trigger().focus();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();

    const action = overlayRoot().querySelector(
      '[data-testid="notification-action"]',
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(action);

    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(harness.open()).toBe(false);
    expect(document.activeElement).toBe(trigger());
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.oc-popover__trigger') as HTMLButtonElement;
  }

  function overlayRoot(): ParentNode {
    return document.querySelector('.cdk-overlay-container') ?? fixture.nativeElement;
  }
});
