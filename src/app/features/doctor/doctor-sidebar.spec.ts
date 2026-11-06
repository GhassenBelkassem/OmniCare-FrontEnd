import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SidebarNavigationItem } from '../../shared/ui';
import { DoctorSidebar } from './doctor-sidebar';

describe('DoctorSidebar', () => {
  const navigation: readonly SidebarNavigationItem[] = [
    {
      id: 'daily-work',
      label: 'Activité clinique',
      icon: 'workspace',
      children: [{ id: 'command', label: 'Accueil', icon: 'workspace', route: '/doctor/command' }],
    },
    {
      id: 'clinical-follow-up',
      label: 'Suivi clinique',
      icon: 'tasks',
      children: [
        { id: 'requests', label: 'Demandes', icon: 'requests', route: '/doctor/requests' },
      ],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders the approved hierarchy, active state, production badge and profile', () => {
    const fixture = TestBed.createComponent(DoctorSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'command');
    fixture.componentRef.setInput('notificationBadge', 2);
    fixture.componentRef.setInput('profile', {
      initials: 'AG',
      name: 'Dr Amina Gharbi',
      context: 'Cardiologie',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.doctor-sidebar__item-icon')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent).toContain(
      'Accueil',
    );
    expect(fixture.nativeElement.querySelector('.doctor-sidebar__badge')?.textContent.trim()).toBe(
      '2',
    );
    expect(fixture.nativeElement.querySelector('.doctor-sidebar__profile')?.textContent).toContain(
      'Dr Amina Gharbi',
    );
  });

  it('preserves accessible group, collapse, mobile-close and logout interactions', () => {
    const fixture = TestBed.createComponent(DoctorSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'command');
    fixture.componentRef.setInput('mobileOpen', true);
    fixture.componentRef.setInput('profile', {
      initials: 'AG',
      name: 'Dr Amina Gharbi',
      context: 'Cardiologie',
    });
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector(
      '.doctor-sidebar__group-button',
    ) as HTMLButtonElement;
    expect(group.getAttribute('aria-expanded')).toBe('true');
    group.click();
    fixture.detectChanges();
    expect(group.getAttribute('aria-expanded')).toBe('false');

    group.click();
    fixture.detectChanges();
    fixture.componentInstance.activateLink(navigation[0]?.children?.[0]!, new Event('click'));
    expect(fixture.componentInstance.mobileOpen()).toBe(false);

    const collapse = fixture.nativeElement.querySelector(
      '[aria-label="Collapse navigation"]',
    ) as HTMLButtonElement;
    collapse.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label="Sign out"]')).toBeTruthy();
  });
});
