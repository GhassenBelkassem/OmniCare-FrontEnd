import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { OcIcon, OcSheet, OcSidebar, SidebarNavigationItem, SidebarUserProfile } from '../../shared/ui';
import {
  CLINIC_REQUESTS_READ_CAPABILITY,
  hasClinicCapability,
} from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { clinicInitials, clinicRoleLabel } from './clinic-page-utils';

const REQUESTS_ITEM: SidebarNavigationItem = {
  id: 'requests',
  label: 'Requests',
  icon: 'requests',
  route: '/clinic/requests',
};
const STAFF_ITEM: SidebarNavigationItem = {
  id: 'staff',
  label: 'Staff',
  icon: 'staff',
  route: '/clinic/staff',
};
const TASKS_ITEM: SidebarNavigationItem = {
  id: 'tasks',
  label: 'Tasks',
  icon: 'tasks',
  children: [
    { id: 'task-queue', label: 'Position Queue', route: '/clinic/tasks/queue' },
    { id: 'my-tasks', label: 'My Tasks', route: '/clinic/tasks/my' },
  ],
};
const HANDOVERS_ITEM: SidebarNavigationItem = {
  id: 'handovers', label: 'Handovers', icon: 'handover', route: '/clinic/handovers',
};
const ROUTING_INCIDENTS_ITEM: SidebarNavigationItem = {
  id: 'routing-incidents', label: 'Routing Incidents', icon: 'warning', route: '/clinic/routing-incidents',
};
const CONFIGURATION_ITEM: SidebarNavigationItem = { id:'configuration',label:'Configuration',icon:'settings',children:[{id:'positions',label:'Positions',route:'/clinic/positions'},{id:'responsibilities',label:'Responsibilities',route:'/clinic/responsibilities'}] };

@Component({
  selector: 'app-clinic-shell',
  imports: [RouterLink, RouterOutlet, OcIcon, OcSheet, OcSidebar],
  template: `
    <a class="oc-skip-link" href="#clinic-content">Skip to main content</a>
    <div class="clinic-shell">
      @if (profile(); as clinicProfile) {
        <oc-sidebar class="clinic-shell__desktop-sidebar"
          [items]="navigation()"
          [activeId]="activeId()"
          [profile]="clinicProfile"
          (profileMenu)="signOut()"
        />
      }
      <div class="clinic-shell__workspace">
        @if (context.bootstrap(); as bootstrap) {
          <header class="clinic-context-bar">
            <button
              class="clinic-context-bar__menu"
              type="button"
              aria-label="Open clinic navigation"
              (click)="mobileNavigationOpen.set(true)"
            >
              <oc-icon name="menu" />
            </button>
            <a class="clinic-context-bar__identity" routerLink="/clinic/select" aria-label="Change clinic workspace">
              <span>Clinic workspace</span>
              <strong>{{ bootstrap.clinic.clinicName }}</strong>
            </a>
            <span class="clinic-context-bar__role">{{ roleLabel() }}</span>
          </header>
        }
        <main id="clinic-content" class="clinic-shell__content" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
    @if (profile(); as clinicProfile) {
      <!-- OcSheet uses a display-contents overlay host. Keep it outside the workspace grid
           so its closed Brain host can never become an implicit grid item. -->
      <oc-sheet [open]="mobileNavigationOpen()" side="left" title="Clinic navigation" [backdropDismissible]="true" (dismissed)="mobileNavigationOpen.set(false)">
        <oc-sidebar [items]="navigation()" [activeId]="activeId()" [profile]="clinicProfile" (profileMenu)="signOut()" />
      </oc-sheet>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: var(--oc-color-surface-app);
      }
      .clinic-shell {
        width: 100%;
        max-width: 100%;
        min-height: 100dvh;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
      }
      .clinic-shell__workspace {
        grid-column: 2;
        min-width: 0;
        min-height: 100dvh;
      }
      .clinic-shell__desktop-sidebar { display: contents; }
      .clinic-context-bar {
        position: sticky;
        z-index: var(--oc-z-topbar);
        inset-block-start: 0;
        display: flex;
        min-height: 60px;
        align-items: center;
        gap: var(--oc-space-4);
        padding: var(--oc-space-2) var(--oc-space-8);
        border-block-end: 1px solid var(--oc-color-border-subtle);
        background: var(--oc-color-surface-card);
      }
      .clinic-context-bar__identity {
        display: grid;
        line-height: 1.25;
        color: inherit;
        text-decoration: none;
      }
      .clinic-context-bar__identity:hover strong { color: var(--oc-color-brand-primary); }
      .clinic-context-bar__identity:focus-visible { outline: 3px solid var(--oc-color-border-focus); outline-offset: 3px; }
      .clinic-context-bar__identity span,
      .clinic-context-bar__role {
        color: var(--oc-color-text-muted);
        font-size: 12px;
      }
      .clinic-context-bar__identity strong {
        color: var(--oc-color-text-primary);
        font-size: 14px;
      }
      .clinic-context-bar__role {
        padding-inline-start: var(--oc-space-4);
        border-inline-start: 1px solid var(--oc-color-border-subtle);
      }
      .clinic-context-bar__menu {
        min-height: 36px;
        border: 0;
        border-radius: var(--oc-radius-sm);
        background: transparent;
        color: var(--oc-color-text-secondary);
        cursor: pointer;
      }
      .clinic-context-bar__menu:hover {
        background: var(--oc-color-surface-hover);
        color: var(--oc-color-text-primary);
      }
      .clinic-context-bar__menu:focus-visible {
        outline: 3px solid var(--oc-color-border-focus);
        outline-offset: 2px;
      }
      .clinic-context-bar__menu {
        display: none;
        width: 40px;
        place-items: center;
        font-size: 18px;
      }
      .clinic-shell__content {
        min-width: 0;
        min-height: calc(100dvh - var(--oc-topbar-height));
        overflow-y: auto;
        overflow-x: clip;
        padding: var(--oc-space-8);
        background: var(--oc-color-surface-page);
      }
      @media (max-width: 767px) {
        .clinic-shell {
          display: block;
        }
        .clinic-shell__desktop-sidebar { display: none; }
        .clinic-shell__workspace { grid-column: auto; }
        .clinic-context-bar {
          padding-inline: var(--oc-space-4);
        }
        .clinic-context-bar__menu {
          display: grid;
        }
        .clinic-context-bar__role {
          display: none;
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
  readonly context = inject(ClinicContextStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mobileNavigationOpen = signal(false);
  readonly navigation = computed<readonly SidebarNavigationItem[]>(() =>
    [
      ...(hasClinicCapability(this.context.bootstrap(), CLINIC_REQUESTS_READ_CAPABILITY)
        ? [REQUESTS_ITEM]
        : []),
      ...(hasClinicCapability(this.context.bootstrap(), 'CLINIC_TASK_READ') ? [TASKS_ITEM] : []),
      ...(hasClinicCapability(this.context.bootstrap(), 'CLINIC_TASK_HANDOVER')
        ? [HANDOVERS_ITEM]
        : []),
      ...(hasClinicCapability(this.context.bootstrap(), 'CLINIC_ROUTING_INCIDENT_READ')
        ? [ROUTING_INCIDENTS_ITEM]
        : []),
      ...(hasClinicCapability(this.context.bootstrap(), 'CLINIC_STAFF_READ')
        ? [STAFF_ITEM]
        : []),
      ...((hasClinicCapability(this.context.bootstrap(), 'CLINIC_POSITION_READ') || hasClinicCapability(this.context.bootstrap(), 'CLINIC_RESPONSIBILITY_READ')) ? [CONFIGURATION_ITEM] : []),
    ],
  );
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly activeId = computed(() =>
    this.currentUrl().startsWith('/clinic/staff')
      ? 'staff'
      : this.currentUrl().startsWith('/clinic/handovers')
        ? 'handovers'
        : this.currentUrl().startsWith('/clinic/routing-incidents')
          ? 'routing-incidents'
          : this.currentUrl().startsWith('/clinic/positions')
            ? 'positions'
            : this.currentUrl().startsWith('/clinic/responsibilities')
              ? 'responsibilities'
      : this.currentUrl().startsWith('/clinic/tasks/queue')
        ? 'task-queue'
        : this.currentUrl().startsWith('/clinic/tasks')
          ? 'my-tasks'
      : this.currentUrl().startsWith('/clinic/requests')
        ? 'requests'
        : '',
  );
  readonly roleLabel = computed(() =>
    clinicRoleLabel(this.context.bootstrap()?.membership.professionalRole ?? ''),
  );
  readonly profile = computed<SidebarUserProfile | null>(() => {
    const bootstrap = this.context.bootstrap();
    if (bootstrap === null) return null;
    return {
      initials: clinicInitials(bootstrap.clinic.clinicName),
      name: bootstrap.clinic.clinicName,
      context: clinicRoleLabel(bootstrap.membership.professionalRole),
    };
  });

  signOut(): void {
    this.context.clear();
    this.auth.logout();
  }
}
