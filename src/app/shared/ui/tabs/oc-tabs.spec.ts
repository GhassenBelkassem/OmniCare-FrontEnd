import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { OcTabs } from './oc-tabs';

describe('OcTabs', () => {
  let fixture: ComponentFixture<OcTabs>;
  let component: OcTabs;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OcTabs],
      providers: [provideRouter([]), provideNzIcons(OMNICARE_ICONS)],
    });
    fixture = TestBed.createComponent(OcTabs);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tabs', [
      { id: 'overview', label: 'Vue d’ensemble' },
      { id: 'disabled', label: 'Indisponible', disabled: true },
      { id: 'services', label: 'Services' },
    ]);
    fixture.componentRef.setInput('selected', 'overview');
    fixture.detectChanges();
  });

  it('keeps only the selected tab in the page tab order', () => {
    const root = fixture.nativeElement as HTMLElement;
    const tabs = root.querySelectorAll<HTMLElement>('[role="tab"]');

    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('false');
  });

  it('supports wrapping arrow navigation and skips disabled tabs', () => {
    const root = fixture.nativeElement as HTMLElement;
    const tabs = root.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(component.selected()).toBe('services');
    expect(document.activeElement).toBe(tabs[2]);

    tabs[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(component.selected()).toBe('overview');
  });

  it('supports Home and End without adding extra tab stops', () => {
    const root = fixture.nativeElement as HTMLElement;
    const tabs = root.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(component.selected()).toBe('services');

    tabs[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(component.selected()).toBe('overview');
  });
});
