import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { OcActionMenu } from './oc-action-menu';

describe('OcActionMenu', () => {
  let fixture: ComponentFixture<OcActionMenu>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OcActionMenu],
      providers: [provideNzIcons(OMNICARE_ICONS)],
    });
    fixture = TestBed.createComponent(OcActionMenu);
  });

  it('renders a labelled compact menu trigger', () => {
    fixture.componentRef.setInput('label', 'Plus d’actions pour Cabinet La Marsa');
    fixture.detectChanges();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '.oc-action-menu__trigger',
    );
    expect(trigger?.getAttribute('type')).toBe('button');
    expect(trigger?.getAttribute('aria-label')).toBe('Plus d’actions pour Cabinet La Marsa');
    expect(trigger?.getAttribute('title')).toBe('Plus d’actions pour Cabinet La Marsa');
  });
});
