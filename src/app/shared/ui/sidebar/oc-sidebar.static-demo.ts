import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OcIcon, OcIconName } from '../icon/oc-icon';

export interface SidebarNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: OcIconName | string;
  readonly route?: string;
  readonly children?: readonly SidebarNavigationItem[];
  readonly badge?: string | number;
  readonly disabled?: boolean;
}

export interface SidebarUserProfile {
  readonly initials: string;
  readonly name: string;
  readonly context: string;
}

export interface SidebarLabels {
  readonly landmark: string;
  readonly workspace: string;
  readonly navigation: string;
  readonly noResults: string;
  readonly signOut: string;
  readonly expand: string;
  readonly collapse: string;
}

const DEFAULT_LABELS: SidebarLabels = {
  landmark: 'Primary navigation',
  workspace: 'Clinical workspace',
  navigation: 'Workspace',
  noResults: 'No navigation matches',
  signOut: 'Sign out',
  expand: 'Expand navigation',
  collapse: 'Collapse navigation',
};

@Component({
  selector: 'oc-sidebar',
  imports: [NgOptimizedImage, RouterLink, OcIcon],
  template: `
    <aside
      class="oc-sidebar"
      [class.oc-sidebar--collapsed]="collapsed()"
      [class.oc-sidebar--mobile-open]="mobileOpen()"
      [attr.aria-label]="resolvedLabels().landmark"
    >
      <div class="oc-sidebar__brand">
        <span class="oc-sidebar__brand-mark" aria-hidden="true">
          <img ngSrc="assets/icon/app_icon.png" width="44" height="44" alt="" priority />
        </span>
        @if (!collapsed()) {
          <span class="oc-sidebar__brand-name">
            OmniCare
            <small>{{ resolvedLabels().workspace }}</small>
          </span>
        }
      </div>

      <nav class="oc-sidebar__nav" [attr.aria-label]="resolvedLabels().navigation">
        <ul>
          @for (item of filteredItems(); track item.id) {
            <li [class.oc-sidebar__section]="item.children?.length">
              @if (item.children?.length) {
                <button
                  class="oc-sidebar__group-button"
                  [attr.title]="collapsed() ? item.label : null"
                  [attr.aria-label]="collapsed() ? item.label : null"
                  type="button"
                  [disabled]="item.disabled"
                  [attr.aria-expanded]="!collapsed() && isExpanded(item.id)"
                  [attr.aria-controls]="!collapsed() ? 'oc-sidebar-group-' + item.id : null"
                  [class.oc-sidebar__item--parent-active]="isParentActive(item)"
                  (click)="toggleGroup(item.id)"
                >
                  @if (item.icon) {
                    <span class="oc-sidebar__group-icon" aria-hidden="true">
                      <oc-icon [name]="item.icon" />
                    </span>
                  }
                  @if (!collapsed()) {
                    <span class="oc-sidebar__group-label">{{ item.label }}</span>
                    <oc-icon
                      class="oc-sidebar__chevron"
                      [name]="isExpanded(item.id) ? 'chevron-down' : 'chevron-right'"
                    />
                  }
                </button>
                @if (!collapsed() && isExpanded(item.id)) {
                  <ul class="oc-sidebar__children" [id]="'oc-sidebar-group-' + item.id">
                    @for (child of item.children; track child.id) {
                      <li>
                        <a
                          [routerLink]="child.disabled ? null : (child.route ?? null)"
                          [class.oc-sidebar__item--active]="activeId() === child.id"
                          [attr.aria-current]="activeId() === child.id ? 'page' : null"
                          [attr.aria-disabled]="child.disabled || !child.route || null"
                          (click)="activateLink(child, $event)"
                        >
                          @if (child.icon) {
                            <span class="oc-sidebar__item-icon" aria-hidden="true">
                              <oc-icon [name]="child.icon" />
                            </span>
                          }
                          <span class="oc-sidebar__item-label">{{ child.label }}</span>
                          @if (badgeFor(child); as badge) {
                            <span
                              class="oc-sidebar__badge"
                              [attr.aria-label]="badge + ' non lues'"
                              >{{ badge }}</span
                            >
                          }
                        </a>
                      </li>
                    }
                  </ul>
                }
              } @else {
                <a
                  class="oc-sidebar__standalone"
                  [attr.title]="collapsed() ? item.label : null"
                  [attr.aria-label]="collapsed() ? item.label : null"
                  [routerLink]="item.disabled ? null : (item.route ?? null)"
                  [class.oc-sidebar__item--active]="activeId() === item.id"
                  [attr.aria-current]="activeId() === item.id ? 'page' : null"
                  [attr.aria-disabled]="item.disabled || !item.route || null"
                  (click)="activateLink(item, $event)"
                >
                  @if (item.icon) {
                    <span class="oc-sidebar__item-icon" aria-hidden="true">
                      <oc-icon [name]="item.icon" />
                    </span>
                  }
                  @if (!collapsed()) {
                    <span class="oc-sidebar__item-label">{{ item.label }}</span>
                  }
                </a>
              }
            </li>
          }
        </ul>
        @if (filteredItems().length === 0) {
          <p class="oc-sidebar__no-results">{{ resolvedLabels().noResults }} “{{ query() }}”.</p>
        }
      </nav>

      @if (profile(); as userProfile) {
        <div class="oc-sidebar__profile">
          @if (collapsed()) {
            <button
              class="oc-sidebar__avatar oc-sidebar__avatar--action"
              type="button"
              [attr.aria-label]="resolvedLabels().signOut"
              (click)="profileMenu.emit()"
            >
              {{ userProfile.initials }}
            </button>
          } @else {
            <span class="oc-sidebar__avatar" aria-hidden="true">{{ userProfile.initials }}</span>
            <span class="oc-sidebar__profile-copy">
              <strong>{{ userProfile.name }}</strong>
              <small>{{ userProfile.context }}</small>
            </span>
            <button
              type="button"
              [attr.aria-label]="resolvedLabels().signOut"
              (click)="profileMenu.emit()"
            >
              <oc-icon name="external" />
            </button>
          }
        </div>
      }

      <button
        class="oc-sidebar__collapse"
        type="button"
        [attr.aria-label]="collapsed() ? resolvedLabels().expand : resolvedLabels().collapse"
        (click)="collapsed.update((value) => !value)"
      >
        <span class="oc-sidebar__collapse-icon" aria-hidden="true">
          <oc-icon [name]="collapsed() ? 'chevron-right' : 'chevron-left'" />
        </span>
        @if (!collapsed()) {
          <span>{{ resolvedLabels().collapse }}</span>
        }
      </button>
    </aside>
  `,
  styleUrl: './oc-sidebar.static-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSidebar {
  private readonly defaultExpandedGroups = new Set(['daily-work', 'clinical-follow-up']);
  private readonly closedDefaultGroups = signal<ReadonlySet<string>>(new Set());
  readonly items = input.required<readonly SidebarNavigationItem[]>();
  readonly activeId = input.required<string>();
  readonly collapsed = model(false);
  readonly mobileOpen = model(false);
  readonly expandedGroups = model<ReadonlySet<string>>(new Set());
  readonly profile = input<SidebarUserProfile>();
  readonly labels = input<Partial<SidebarLabels>>({});
  readonly notificationBadge = input(0);
  readonly profileMenu = output<void>();
  readonly query = signal('');
  readonly resolvedLabels = computed(() => ({ ...DEFAULT_LABELS, ...this.labels() }));
  readonly filteredItems = computed(() => {
    const term = this.query().trim().toLocaleLowerCase();
    if (!term) return this.items();
    return this.items().flatMap((item) => {
      const ownMatch = item.label.toLocaleLowerCase().includes(term);
      const matchingChildren = item.children?.filter((child) =>
        child.label.toLocaleLowerCase().includes(term),
      );
      if (ownMatch) return [item];
      if (matchingChildren?.length) return [{ ...item, children: matchingChildren }];
      return [];
    });
  });

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  badgeFor(item: SidebarNavigationItem): string | number | null {
    if (item.badge !== undefined) return item.badge;
    if (item.id === 'requests' && this.notificationBadge() > 0) return this.notificationBadge();
    return null;
  }

  activateLink(item: SidebarNavigationItem, event: Event): void {
    if (item.disabled || !item.route) {
      event.preventDefault();
      return;
    }
    this.mobileOpen.set(false);
  }

  toggleGroup(id: string): void {
    if (this.collapsed()) {
      this.collapsed.set(false);
      if (!this.isExpanded(id)) {
        this.expandedGroups.update((current) => new Set(current).add(id));
      }
      return;
    }
    this.expandedGroups.update((current) => {
      const next = new Set(current);
      if (this.isExpanded(id)) {
        next.delete(id);
        if (this.defaultExpandedGroups.has(id)) {
          this.closedDefaultGroups.update((closed) => new Set(closed).add(id));
        }
      } else {
        next.add(id);
        this.closedDefaultGroups.update((closed) => {
          const updated = new Set(closed);
          updated.delete(id);
          return updated;
        });
      }
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return (
      this.expandedGroups().has(id) ||
      (this.defaultExpandedGroups.has(id) && !this.closedDefaultGroups().has(id)) ||
      this.query().trim().length > 0
    );
  }

  isParentActive(item: SidebarNavigationItem): boolean {
    return item.children?.some((child) => child.id === this.activeId()) ?? false;
  }
}
