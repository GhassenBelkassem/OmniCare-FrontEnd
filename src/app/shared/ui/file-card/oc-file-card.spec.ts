import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { OcFileCard } from './oc-file-card';

describe('OcFileCard', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(disabled = false) {
    TestBed.configureTestingModule({ providers: [provideNzIcons(OMNICARE_ICONS)] });
    const fixture = TestBed.createComponent(OcFileCard);
    fixture.componentRef.setInput('title', 'Ordonnance');
    fixture.componentRef.setInput('subtitle', '2 médicaments');
    fixture.componentRef.setInput('disabled', disabled);
    const activate = vi.fn();
    fixture.componentInstance.activate.subscribe(activate);
    fixture.detectChanges();
    return { fixture, activate, button: (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement };
  }

  it('is one native button named by its action, title and subtitle', () => {
    const { button, activate } = render();
    expect(button.getAttribute('aria-label')).toBe('Télécharger : Ordonnance, 2 médicaments');
    expect(button.textContent).toContain('PDF');
    button.click();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const { button, activate } = render(true);
    expect(button.disabled).toBe(true);
    button.click();
    expect(activate).not.toHaveBeenCalled();
  });
});
