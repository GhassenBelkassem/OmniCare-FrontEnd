import { TestBed } from '@angular/core/testing';

import { OcSegmentedControl } from './oc-segmented-control';

describe('OcSegmentedControl', () => {
  const options = [
    { value: 'list', label: 'List' },
    { value: 'board', label: 'Board' },
  ] as const;

  it('updates selection on click', () => {
    const fixture = TestBed.createComponent(OcSegmentedControl);
    fixture.componentRef.setInput('label', 'View mode');
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('selected', 'list');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[1]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selected()).toBe('board');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('supports arrow-key selection', () => {
    const fixture = TestBed.createComponent(OcSegmentedControl);
    fixture.componentRef.setInput('label', 'View mode');
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('selected', 'list');
    fixture.detectChanges();

    const first = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.selected()).toBe('board');
  });
});
