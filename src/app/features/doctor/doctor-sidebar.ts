import { NgOptimizedImage } from '@angular/common';
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

import { OcIcon, SidebarLabels, SidebarNavigationItem, SidebarUserProfile } from '../../shared/ui';

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
  selector: 'app-doctor-sidebar',
  imports: [NgOptimizedImage, RouterLink, OcIcon],
  templateUrl: './doctor-sidebar.html',
  styleUrl: './doctor-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorSidebar {
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
      (this.defaultExpandedGroups.has(id) && !this.closedDefaultGroups().has(id))
    );
  }

  isParentActive(item: SidebarNavigationItem): boolean {
    return item.children?.some((child) => child.id === this.activeId()) ?? false;
  }
}
