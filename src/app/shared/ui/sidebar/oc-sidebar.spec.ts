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

  it('renders the OmniCare icon in the dashboard brand', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'appointments');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector(
      '.oc-sidebar__brand-mark img',
    ) as HTMLImageElement;
    expect(icon.getAttribute('ngsrc')).toBe('assets/icon/app_icon.png');
    expect(icon.alt).toBe('');
    expect(icon.width).toBe(36);
    expect(icon.height).toBe(36);
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

  it('expands the rail and reveals a group when its collapsed icon is activated', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', '');
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector(
      '.oc-sidebar__group-button',
    ) as HTMLButtonElement;
    expect(group.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.oc-sidebar__children')).toBeNull();

    group.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.collapsed()).toBe(false);
    expect(group.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.oc-sidebar__children')).toBeTruthy();
  });

  it('supports French shell labels without changing the reusable default', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'appointments');
    fixture.componentRef.setInput('profile', {
      initials: 'BS',
      name: 'Dr Ben Salah',
      context: 'Médecine générale',
    });
    fixture.componentRef.setInput('labels', {
      landmark: 'Navigation principale',
      workspace: 'Espace clinique',
      navigation: 'Espace médecin',
      signOut: 'Se déconnecter',
      collapse: 'Réduire la navigation',
      expand: 'Développer la navigation',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('aside').getAttribute('aria-label')).toBe(
      'Navigation principale',
    );
    expect(fixture.nativeElement.textContent).toContain('Espace clinique');
    expect(fixture.nativeElement.querySelector('[aria-label="Se déconnecter"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Dr Ben Salah');
  });
});
