import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OcIcon } from './oc-icon';

@Component({
  imports: [OcIcon],
  template: '<oc-icon [name]="name()" [intent]="intent()" [decorative]="decorative()" label="Task status" />',
})
class IconHarness {
  readonly name = signal('tasks');
  readonly intent = signal<'neutral' | 'primary' | 'success' | 'information' | 'warning' | 'critical' | 'coordination'>('neutral');
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

  it('renders a safe fallback for an unregistered name', () => {
    fixture.componentInstance.name.set('legacy-icon');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('rect')).toBeTruthy();
  });
});
