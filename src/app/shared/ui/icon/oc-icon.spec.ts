import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OcIcon } from './oc-icon';

@Component({
  imports: [OcIcon],
  template:
    '<oc-icon [name]="name()" [intent]="intent()" [decorative]="decorative()" label="Task status" />',
})
class IconHarness {
  readonly name = signal('tasks');
  readonly intent = signal<
    'neutral' | 'primary' | 'success' | 'information' | 'warning' | 'critical' | 'coordination'
  >('neutral');
  readonly decorative = signal(true);
}

describe('OcIcon', () => {
  let fixture: ComponentFixture<IconHarness>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IconHarness] });
    fixture = TestBed.createComponent(IconHarness);
    fixture.detectChanges();
  });

  it('hides decorative icons from assistive technology and supports semantic intent', () => {
    const icon = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    fixture.componentInstance.intent.set('coordination');
    fixture.detectChanges();
    expect(icon.classList).toContain('oc-icon--coordination');
  });

  it('uses an accessible image role when an icon is meaningful', () => {
    fixture.componentInstance.decorative.set(false);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.getAttribute('aria-label')).toBe('Task status');
  });

  it('renders and identifies a drawable fallback for an unregistered name', () => {
    fixture.componentInstance.name.set('legacy-icon');
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('data-icon-fallback')).toBe('true');
    expect(svg.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
  });

  it.each(['workspace', 'calendar', 'waiting', 'clinical', 'prescription', 'results', 'analytics'])(
    'renders the registered %s navigation icon instead of the fallback square',
    (name) => {
      fixture.componentInstance.name.set(name);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
      expect(svg.querySelector('rect[d]')).toBeNull();
      expect(svg.innerHTML).not.toContain('x="4" y="4" width="16" height="16"');
    },
  );

  it.each(['home', 'building', 'info', 'warning', 'refresh', 'location', 'coverage', 'phone'])(
    'renders the Urgent Readiness %s icon as registered drawable SVG content',
    (name) => {
      fixture.componentInstance.name.set(name);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.getAttribute('data-icon-name')).toBe(name);
      expect(svg.hasAttribute('data-icon-fallback')).toBe(false);
      expect(svg.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
    },
  );
});
