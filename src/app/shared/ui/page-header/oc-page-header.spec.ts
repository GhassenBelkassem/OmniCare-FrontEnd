import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { OcPageHeader } from './oc-page-header';

@Component({
  imports: [OcPageHeader],
  template: `
    <oc-page-header title="Paramètres" description="Configuration Doctor">
      <button ocPrimaryAction type="button">Enregistrer</button>
    </oc-page-header>
  `,
})
class TestHost {}

describe('OcPageHeader', () => {
  it('gives the actions wrapper a valid labelled group role without changing focus order', () => {
    TestBed.configureTestingModule({ imports: [TestHost] });
    const fixture: ComponentFixture<TestHost> = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const group = root.querySelector<HTMLElement>('.oc-page-header__actions');
    const button = group?.querySelector<HTMLButtonElement>('button');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Actions de la page');
    expect(button?.textContent).toContain('Enregistrer');
  });
});
