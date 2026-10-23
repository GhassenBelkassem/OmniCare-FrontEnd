import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { OcSidebar, SidebarNavigationItem, SidebarUserProfile } from '../../shared/ui';

const NAVIGATION: readonly SidebarNavigationItem[] = [
  { id: 'professionals', label: 'Professionals', icon: 'team', route: '/admin/professionals' },
  { id: 'patients', label: 'Patients', icon: 'user', route: '/admin/patients' },
  { id: 'clinics', label: 'Clinics', icon: 'medicine-box', route: '/admin/clinics' },
  { id: 'monitoring', label: 'Monitoring', icon: 'workspace', route: '/admin/monitoring' },
];

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, OcSidebar],
  template: `
    <a class="oc-skip-link" href="#admin-content">Skip to main content</a>
    <div class="admin-shell">
      <oc-sidebar
        [items]="navigation"
        [activeId]="activeId()"
        [profile]="profile"
        (profileMenu)="auth.logout()"
      />
      <main id="admin-content" class="admin-shell__content" tabindex="-1"><router-outlet /></main>
    </div>
  `,
  styleUrl: './admin-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly navigation = NAVIGATION;
  readonly profile: SidebarUserProfile = { initials: 'SA', name: 'Super admin', context: 'Platform administration' };
  readonly activeId = signal(this.resolveActive(this.router.url));

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => this.activeId.set(this.resolveActive(event.urlAfterRedirects)));
  }

  /**
   * Longest-prefix order matters: `/admin/patients` is its own entry, so it is matched
   * before the professionals fallback rather than being highlighted as "Professionals".
   */
  private resolveActive(url: string): string {
    if (url.startsWith('/admin/monitoring')) return 'monitoring';
    if (url.startsWith('/admin/professionals')) return 'professionals';
    if (url.startsWith('/admin/patients')) return 'patients';
    if (url.startsWith('/admin/clinics')) return 'clinics';
    return 'professionals';
  }
}
