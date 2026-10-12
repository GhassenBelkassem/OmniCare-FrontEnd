import { TestBed } from '@angular/core/testing';
import { provideNzI18n, en_GB } from 'ng-zorro-antd/i18n';
import { describe, expect, it, vi } from 'vitest';

import { OcConfirmDialog } from './oc-confirm-dialog';

describe('OcConfirmDialog', () => {
  it('renders explicit cancel and confirmation actions in the modal footer', () => {
    const fixture = createDialog();

    const modal = document.body.querySelector('.ant-modal') as HTMLElement;
    const footer = modal.querySelector('.ant-modal-footer') as HTMLElement;
    expect(modal.textContent).toContain('Marquer ce jour comme fermé');
    expect(modal.textContent).toContain('Les rendez-vous existants restent inchangés.');
    expect(footer.textContent).toContain('Annuler');
    expect(footer.textContent).toContain('Marquer comme fermé');
    expect(footer.querySelectorAll('button')).toHaveLength(2);

    fixture.destroy();
  });

  it('emits the selected footer action', () => {
    const fixture = createDialog();
    const confirm = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirm);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    const buttons = document.body.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button');

    buttons[1].click();
    expect(confirm).toHaveBeenCalledOnce();

    buttons[0].click();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.open()).toBe(false);

    fixture.destroy();
  });

  it('disables dismissal and both footer actions while loading', () => {
    const fixture = createDialog(true);
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    const buttons = document.body.querySelectorAll<HTMLButtonElement>('.ant-modal-footer button');

    expect([...buttons].every((button) => button.disabled)).toBe(true);
    fixture.componentInstance.close();
    expect(fixture.componentInstance.open()).toBe(true);
    expect(cancelled).not.toHaveBeenCalled();

    fixture.destroy();
  });
});

function createDialog(loading = false) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [OcConfirmDialog],
    providers: [provideNzI18n(en_GB)],
  });
  const fixture = TestBed.createComponent(OcConfirmDialog);
  fixture.componentRef.setInput('open', true);
  fixture.componentRef.setInput('title', 'Marquer ce jour comme fermé');
  fixture.componentRef.setInput('message', 'Les rendez-vous existants restent inchangés.');
  fixture.componentRef.setInput('cancelLabel', 'Annuler');
  fixture.componentRef.setInput('confirmLabel', 'Marquer comme fermé');
  fixture.componentRef.setInput('destructive', true);
  fixture.componentRef.setInput('loading', loading);
  fixture.detectChanges();
  return fixture;
}
