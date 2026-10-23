import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { OMNICARE_ICONS } from '../../../app.icons';
import { UrgentReadinessPage } from './urgent-readiness-page';

describe('UrgentReadinessPage', () => {
  let fixture: ComponentFixture<UrgentReadinessPage>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UrgentReadinessPage],
      providers: [provideRouter([]), provideNzIcons(OMNICARE_ICONS)],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(UrgentReadinessPage);
    fixture.detectChanges();
  });

  it('removes fabricated operational values and identifies Services as the single source', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Une seule source de préparation');
    expect(text).toContain('l’onglet Services');
    expect(text).toContain('ne présente plus');
    expect(text).not.toContain('Aperçu statique');
    expect(text).not.toContain('Projection synthétique');
    expect(text).not.toContain('Cabinet Démo');
  });

  it('navigates to the existing Services tab without becoming another editor', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.click();

    expect(navigate).toHaveBeenCalledWith(['/doctor/settings'], {
      queryParams: { tab: 'services' },
    });
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
