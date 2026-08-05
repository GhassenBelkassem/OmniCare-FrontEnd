import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import {
  DownOutline,
  MedicineBoxOutline,
  MenuFoldOutline,
  MenuUnfoldOutline,
  MoreOutline,
  UpOutline,
} from '@ant-design/icons-angular/icons';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OcSidebar, SidebarNavigationItem } from './oc-sidebar';

describe('OcSidebar', () => {
  const navigation: readonly SidebarNavigationItem[] = [
    {
      id: 'clinical-operations',
      label: 'Clinical Operations',
      icon: 'medicine-box',
      children: [{ id: 'appointments', label: 'Appointments', route: '/appointments' }],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons([
          DownOutline,
          MedicineBoxOutline,
          MenuFoldOutline,
          MenuUnfoldOutline,
          MoreOutline,
          UpOutline,
        ]),
      ],
    });
  });

  it('expands and collapses navigation groups with aria state', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'appointments');
    fixture.componentRef.setInput('expandedGroups', new Set(['clinical-operations']));
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector(
      '.oc-sidebar__group-button',
    ) as HTMLButtonElement;
    expect(group.getAttribute('aria-expanded')).toBe('true');
    group.click();
    fixture.detectChanges();
    expect(group.getAttribute('aria-expanded')).toBe('false');
  });

  it('represents the active child and parent without color alone', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'appointments');
    fixture.componentRef.setInput('expandedGroups', new Set(['clinical-operations']));
    fixture.detectChanges();

    const active = fixture.nativeElement.querySelector(
      '[aria-current="page"]',
    ) as HTMLAnchorElement;
    const parent = fixture.nativeElement.querySelector(
      '.oc-sidebar__item--parent-active',
    ) as HTMLButtonElement;
    expect(active.textContent).toContain('Appointments');
    expect(parent).toBeTruthy();
  });

  it('toggles the collapsed model from its accessible button', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'appointments');
    fixture.componentRef.setInput('expandedGroups', new Set(['clinical-operations']));
    fixture.detectChanges();

    const collapse = fixture.nativeElement.querySelector(
      '[aria-label="Collapse navigation"]',
    ) as HTMLButtonElement;
    collapse.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label="Expand navigation"]')).toBeTruthy();
  });
});
