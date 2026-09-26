import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { OcTagInput } from './oc-tag-input';

describe('OcTagInput', () => {
  let fixture: ComponentFixture<OcTagInput>;
  let component: OcTagInput;
  let changes: string[][];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OcTagInput] });
    fixture = TestBed.createComponent(OcTagInput);
    fixture.componentRef.setInput('controlId', 'tag-input');
    component = fixture.componentInstance;
    changes = [];
    component.registerOnChange((value) => {
      changes.push([...value]);
    });
    component.writeValue([]);
    fixture.detectChanges();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function input(): HTMLInputElement {
    const nativeInput = host().querySelector<HTMLInputElement>('.oc-tag-input__text');
    if (nativeInput === null) {
      throw new Error('tag input field not rendered');
    }
    return nativeInput;
  }

  it('renders the provided tags as removable chips', () => {
    component.writeValue(['Francais', 'Arabe']);
    fixture.detectChanges();
    const chips = host().querySelectorAll('.oc-tag-input__chip');
    expect(chips.length).toBe(2);
    expect(host().textContent).toContain('Francais');
    expect(host().textContent).toContain('Arabe');
  });

  it('adds a tag on Enter and emits through the CVA', () => {
    const nativeInput = input();
    nativeInput.value = 'Anglais';
    nativeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    nativeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(component.value()).toEqual(['Anglais']);
    expect(changes).toEqual([['Anglais']]);
    expect(host().textContent).toContain('Anglais');
  });

  it('adds a tag on comma and clears the typed text', async () => {
    const nativeInput = input();
    nativeInput.value = 'Adultes';
    nativeInput.dispatchEvent(new Event('input'));
    nativeInput.dispatchEvent(new KeyboardEvent('keydown', { key: ',' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.value()).toEqual(['Adultes']);
    expect(input().value).not.toContain('Adultes');
  });

  it('ignores duplicate tags case-insensitively', () => {
    component.writeValue(['Francais']);
    fixture.detectChanges();
    const nativeInput = input();
    nativeInput.value = 'francais';
    nativeInput.dispatchEvent(new Event('input'));
    nativeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(component.value()).toEqual(['Francais']);
  });

  it('removes a tag from its chip button and emits', () => {
    component.writeValue(['Francais', 'Arabe']);
    fixture.detectChanges();
    const removeButtons = host().querySelectorAll<HTMLButtonElement>('.oc-tag-input__remove');
    removeButtons[0].click();
    fixture.detectChanges();
    expect(component.value()).toEqual(['Arabe']);
    expect(changes).toEqual([['Arabe']]);
  });

  it('removes the last tag with Backspace on an empty field', () => {
    component.writeValue(['Francais', 'Arabe']);
    fixture.detectChanges();
    const nativeInput = input();
    nativeInput.value = '';
    nativeInput.dispatchEvent(new Event('input'));
    nativeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    fixture.detectChanges();
    expect(component.value()).toEqual(['Francais']);
  });

  it('stops accepting tags at maxTags and locks the field', () => {
    component.writeValue(Array.from({ length: 50 }, (_v, i) => `t${i}`));
    fixture.detectChanges();
    const nativeInput = input();
    expect(nativeInput.getAttribute('readonly')).not.toBeNull();
    expect(host().textContent).toContain('Maximum 50 elements');
  });

  it('reflects the disabled state on the chips', () => {
    component.setDisabledState(true);
    fixture.detectChanges();
    expect(host().querySelector('.oc-tag-input--disabled')).not.toBeNull();
  });
});