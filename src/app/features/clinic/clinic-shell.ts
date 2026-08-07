import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { OcSidebar, SidebarNavigationItem, SidebarUserProfile } from '../../shared/ui';
import { ClinicContextStore } from './clinic-context.store';
import { clinicInitials, clinicRoleLabel } from './clinic-page-utils';

/** Phase 1 exposes the overview only. Disabled modules never become navigation entries. */
const NAVIGATION: readonly SidebarNavigationItem[] = [
  { id: 'overview', label: 'Clinic overview', icon: 'dashboard', route: '/clinic/overview' },
];

@Component({
  selector: 'app-clinic-shell',
  imports: [RouterOutlet, OcSidebar],
  template: `
    <a class="oc-skip-link" href="#clinic-content">Skip to main content</a>
    <div class="clinic-shell">
      @if (profile(); as clinicProfile) {
        <oc-sidebar
          [items]="navigation"
          activeId="overview"
          [profile]="clinicProfile"
          (profileMenu)="signOut()"
        />
      }
      <main id="clinic-content" class="clinic-shell__content" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: var(--oc-color-surface-app);
      }
      .clinic-shell {
        min-height: 100dvh;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
      }
      .clinic-shell__content {
        min-width: 0;
        padding: var(--oc-space-8);
        background: var(--oc-color-surface-page);
      }
      @media (max-width: 767px) {
        .clinic-shell {
          display: block;
        }
        .clinic-shell__content {
          padding: var(--oc-space-4);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicShell {
  private readonly store = inject(ClinicContextStore);
  private readonly auth = inject(AuthService);
  readonly navigation = NAVIGATION;

  readonly profile = computed<SidebarUserProfile | null>(() => {
    const bootstrap = this.store.bootstrap();
    if (bootstrap === null) return null;
    return {
      initials: clinicInitials(bootstrap.clinic.clinicName),
      name: bootstrap.clinic.clinicName,
      context: clinicRoleLabel(bootstrap.membership.professionalRole),
    };
  });

  signOut(): void {
    this.store.clear();
    this.auth.logout();
  }
}
