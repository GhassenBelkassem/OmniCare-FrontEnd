import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
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

@Component({
  selector: 'oc-sidebar',
  imports: [RouterLink, OcIcon],
  template: `
    <aside
      class="oc-sidebar"
      [class.oc-sidebar--collapsed]="collapsed()"
      [class.oc-sidebar--mobile-open]="mobileOpen()"
      aria-label="Primary navigation"
    >
      <div class="oc-sidebar__brand">
        <span class="oc-sidebar__brand-mark" aria-hidden="true">O<span>+</span></span>
        @if (!collapsed()) {
          <span class="oc-sidebar__brand-name">OmniCare<small>Clinical workspace</small></span>
        }
      </div>

      <nav class="oc-sidebar__nav" aria-label="Workspace">
        <ul>
          @for (item of filteredItems(); track item.id) {
            <li>
              @if (item.children?.length) {
                <button
                  class="oc-sidebar__group-button"
                  [attr.title]="collapsed() ? item.label : null"
                  type="button"
                  [disabled]="item.disabled"
                  [attr.aria-expanded]="isExpanded(item.id)"
                  [class.oc-sidebar__item--parent-active]="isParentActive(item)"
                  (click)="toggleGroup(item.id)"
                >
                  @if (item.icon) {
                    <oc-icon [name]="item.icon" intent="information" />
                  }
                  @if (!collapsed()) {
                    <span>{{ item.label }}</span>
                    <oc-icon class="oc-sidebar__chevron" [name]="isExpanded(item.id) ? 'chevron-down' : 'chevron-right'" />
                  }
                </button>
                @if (!collapsed() && isExpanded(item.id)) {
                  <ul class="oc-sidebar__children">
                    @for (child of item.children; track child.id) {
                      <li>
                        <a
                          [routerLink]="child.route ?? null"
                          [class.oc-sidebar__item--active]="activeId() === child.id"
                          [attr.aria-current]="activeId() === child.id ? 'page' : null"
                          [attr.aria-disabled]="child.disabled || !child.route || null"
                          (click)="mobileOpen.set(false)"
                        >
                          <span>{{ child.label }}</span>
                          @if (child.badge !== undefined) {
                            <span class="oc-sidebar__badge">{{ child.badge }}</span>
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
                  [routerLink]="item.route ?? null"
                  [class.oc-sidebar__item--active]="activeId() === item.id"
                  [attr.aria-current]="activeId() === item.id ? 'page' : null"
                  [attr.aria-disabled]="item.disabled || !item.route || null"
                  (click)="mobileOpen.set(false)"
                >
                  @if (item.icon) {
                    <oc-icon [name]="item.icon" intent="information" />
                  }
                  @if (!collapsed()) {
                    <span>{{ item.label }}</span>
                  }
                </a>
              }
            </li>
          }
        </ul>
        @if (filteredItems().length === 0) {
          <p class="oc-sidebar__no-results">No navigation matches “{{ query() }}”.</p>
        }
      </nav>

      @if (profile(); as userProfile) {
        <div class="oc-sidebar__profile">
          <span class="oc-sidebar__avatar" aria-hidden="true">{{ userProfile.initials }}</span>
          @if (!collapsed()) {
            <span class="oc-sidebar__profile-copy"
              ><strong>{{ userProfile.name }}</strong
              ><small>{{ userProfile.context }}</small></span
            >
            <button
              type="button"
              aria-label="Sign out"
              (click)="profileMenu.emit()"
            >
              <oc-icon name="close" /><span>Sign out</span>
            </button>
          }
        </div>
      }
      <button
        class="oc-sidebar__collapse"
        type="button"
        [attr.aria-label]="collapsed() ? 'Expand navigation' : 'Collapse navigation'"
        (click)="collapsed.update((value) => !value)"
      >
        <oc-icon [name]="collapsed() ? 'chevron-right' : 'chevron-left'" />
        @if (!collapsed()) {
          <span>Collapse navigation</span>
        }
      </button>
    </aside>
  `,
  styleUrl: './oc-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSidebar {
  readonly items = input.required<readonly SidebarNavigationItem[]>();
  readonly activeId = input.required<string>();
  readonly collapsed = model(false);
  readonly mobileOpen = model(false);
  readonly expandedGroups = model<ReadonlySet<string>>(new Set());
  readonly profile = input<SidebarUserProfile>();
  readonly profileMenu = output<void>();
  readonly query = signal('');
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

  toggleGroup(id: string): void {
    this.expandedGroups.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedGroups().has(id) || this.query().trim().length > 0;
  }

  isParentActive(item: SidebarNavigationItem): boolean {
    return item.children?.some((child) => child.id === this.activeId()) ?? false;
  }
}
