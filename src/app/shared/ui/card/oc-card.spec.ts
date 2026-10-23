import { TestBed } from '@angular/core/testing';

import { OcCard } from './oc-card';

describe('OcCard', () => {
  it.each([
    ['information', 'oc-card--information'],
    ['success', 'oc-card--success'],
  ] as const)('applies the opt-in %s semantic tone', (tone, expectedClass) => {
    TestBed.configureTestingModule({ imports: [OcCard] });
    const fixture = TestBed.createComponent(OcCard);
    fixture.componentRef.setInput('title', 'Urgences');
    fixture.componentRef.setInput('tone', tone);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.oc-card').classList).toContain(expectedClass);
  });

  it('keeps neutral cards unchanged by default', () => {
    TestBed.configureTestingModule({ imports: [OcCard] });
    const fixture = TestBed.createComponent(OcCard);
    fixture.componentRef.setInput('title', 'Détails');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.oc-card') as HTMLElement;
    expect(card.classList).not.toContain('oc-card--information');
    expect(card.classList).not.toContain('oc-card--success');
  });
});
