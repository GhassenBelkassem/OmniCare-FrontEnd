import { TestBed } from '@angular/core/testing';
import { CloseOutline } from '@ant-design/icons-angular/icons';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OcAdvancedFilterDrawer } from './advanced-filter-drawer/oc-advanced-filter-drawer';
import { OcFilterChip } from './filter-chip/oc-filter-chip';
import { OcIconButton } from './icon-button/oc-icon-button';

describe('OmniCare filter patterns', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideNzIcons([CloseOutline])] });
  });

  it('opens and closes the advanced filter drawer model', () => {
    const fixture = TestBed.createComponent(OcAdvancedFilterDrawer);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(true);

    fixture.componentInstance.close();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('emits filter chip removal from an accessible button', () => {
    const fixture = TestBed.createComponent(OcFilterChip);
    fixture.componentRef.setInput('label', 'Status');
    fixture.componentRef.setInput('value', 'Pending');
    fixture.detectChanges();
    let removed = false;
    fixture.componentInstance.removed.subscribe(() => (removed = true));

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Remove Status filter');
    button.click();
    expect(removed).toBe(true);
  });

  it('requires and renders an accessible icon-button name', () => {
    const fixture = TestBed.createComponent(OcIconButton);
    fixture.componentRef.setInput('label', 'Close panel');
    fixture.componentRef.setInput('icon', 'close');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Close panel');
  });
});
