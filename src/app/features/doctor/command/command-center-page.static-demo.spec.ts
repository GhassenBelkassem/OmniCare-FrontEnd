import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { CommandCenterPage } from './command-center-page.static-demo';

describe('CommandCenterPage static demo', () => {
  it('renders the approved six-appointment timeline with fictional demo context', async () => {
    await TestBed.configureTestingModule({
      imports: [CommandCenterPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommandCenterPage);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.appointment-row')).toHaveLength(6);
    expect(element.textContent).toContain('Données fictives');
    expect(element.textContent).toContain('Consultation en cours');
    expect(element.textContent).toContain('Planning à jour');
  });

  it('keeps the active-consultation action on the canonical consultation route', async () => {
    await TestBed.configureTestingModule({
      imports: [CommandCenterPage],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommandCenterPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const link = fixture.nativeElement.querySelector('.primary-action--wide') as HTMLAnchorElement;

    expect(router.parseUrl(link.getAttribute('href') ?? '').toString()).toBe(
      '/doctor/consultation/11111111-1111-4111-8111-111111111111',
    );
  });
});
