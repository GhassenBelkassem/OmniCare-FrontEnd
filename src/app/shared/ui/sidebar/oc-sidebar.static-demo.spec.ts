import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OcSidebar, SidebarNavigationItem } from './oc-sidebar.static-demo';

describe('Static-demo OcSidebar', () => {
  const navigation: readonly SidebarNavigationItem[] = [
    {
      id: 'daily-work',
      label: 'Activité clinique',
      icon: 'workspace',
      children: [{ id: 'command', label: 'Accueil', icon: 'home', route: '/doctor/command' }],
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

  it('renders child icons, active semantics and the local notification badge', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'command');
    fixture.componentRef.setInput('expandedGroups', new Set(['daily-work', 'clinical-follow-up']));
    fixture.componentRef.setInput('notificationBadge', 2);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.oc-sidebar__item-icon')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent).toContain(
      'Accueil',
    );
    expect(fixture.nativeElement.querySelector('.oc-sidebar__badge')?.textContent.trim()).toBe('2');
  });

  it('keeps group and compact controls keyboard-addressable with explicit aria state', () => {
    const fixture = TestBed.createComponent(OcSidebar);
    fixture.componentRef.setInput('items', navigation);
    fixture.componentRef.setInput('activeId', 'command');
    fixture.componentRef.setInput('expandedGroups', new Set(['daily-work']));
    fixture.componentRef.setInput('labels', {
      collapse: 'Réduire la navigation',
      expand: 'Développer la navigation',
    });
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector(
      '.oc-sidebar__group-button',
    ) as HTMLButtonElement;
    expect(group.getAttribute('aria-expanded')).toBe('true');
    group.click();
    fixture.detectChanges();
    expect(group.getAttribute('aria-expanded')).toBe('false');

    const compact = fixture.nativeElement.querySelector(
      '[aria-label="Réduire la navigation"]',
    ) as HTMLButtonElement;
    compact.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[aria-label="Développer la navigation"]'),
    ).toBeTruthy();
  });
});
