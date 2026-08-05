import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';

import { OcAdvancedFilterDrawer } from '../../shared/ui/advanced-filter-drawer/oc-advanced-filter-drawer';
import { OcButton } from '../../shared/ui/button/oc-button';
import { OcDataTableShell } from '../../shared/ui/data-table-shell/oc-data-table-shell';
import { OcEmptyState } from '../../shared/ui/empty-state/oc-empty-state';
import { OcFilterChip } from '../../shared/ui/filter-chip/oc-filter-chip';
import { OcFilterToolbar } from '../../shared/ui/filter-toolbar/oc-filter-toolbar';
import { OcIconButton } from '../../shared/ui/icon-button/oc-icon-button';
import { OcMetricCard } from '../../shared/ui/metric-card/oc-metric-card';
import { OcPageHeader } from '../../shared/ui/page-header/oc-page-header';
import {
  OcSegmentOption,
  OcSegmentedControl,
} from '../../shared/ui/segmented-control/oc-segmented-control';
import {
  OcSidebar,
  SidebarNavigationItem,
  SidebarUserProfile,
} from '../../shared/ui/sidebar/oc-sidebar';
import { OcStatus, OcStatusBadge } from '../../shared/ui/status-badge/oc-status-badge';

interface ShowcaseFilter {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

interface AppointmentRow {
  readonly id: string;
  readonly time: string;
  readonly patient: string;
  readonly service: string;
  readonly clinician: string;
  readonly location: string;
  readonly status: OcStatus;
}

@Component({
  selector: 'app-design-system-showcase',
  imports: [
    ReactiveFormsModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzIconModule,
    NzInputModule,
    NzPaginationModule,
    NzRadioModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTableModule,
    OcAdvancedFilterDrawer,
    OcButton,
    OcDataTableShell,
    OcEmptyState,
    OcFilterChip,
    OcFilterToolbar,
    OcIconButton,
    OcMetricCard,
    OcPageHeader,
    OcSegmentedControl,
    OcSidebar,
    OcStatusBadge,
  ],
  templateUrl: './design-system.html',
  styleUrl: './design-system.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemShowcase {
  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly expandedSidebarGroups = signal<ReadonlySet<string>>(
    new Set(['clinical-operations']),
  );
  protected readonly filterOpen = signal(true);
  protected readonly loadingButton = signal(false);
  protected readonly density = signal('comfortable');
  protected readonly tableState = signal<'default' | 'loading' | 'empty' | 'error'>('default');
  protected readonly query = signal('');
  protected readonly viewMode = signal('list');
  protected readonly activeFilters = signal<readonly ShowcaseFilter[]>([
    { id: 'department', label: 'Department', value: 'Cardiology' },
    { id: 'status', label: 'Status', value: 'Confirmed + Pending' },
    { id: 'date', label: 'Date', value: 'This week' },
  ]);

  protected readonly dateRangeControl = new FormControl<Date[] | null>(null);
  protected readonly departmentControl = new FormControl<string[]>(['cardiology']);
  protected readonly typeControl = new FormControl('all', { nonNullable: true });
  protected readonly statusControl = new FormControl<string[]>(['confirmed', 'pending']);
  protected readonly priorityControl = new FormControl('all', { nonNullable: true });
  protected readonly doctorControl = new FormControl<string | null>(null);
  protected readonly roomControl = new FormControl<string | null>(null);
  protected readonly urgentControl = new FormControl(false, { nonNullable: true });

  protected readonly densityOptions: readonly OcSegmentOption[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
  ];

  protected readonly sidebarProfile: SidebarUserProfile = {
    initials: 'AM',
    name: 'Alex Morgan',
    context: 'Clinic operations',
  };

  protected readonly navigation: readonly SidebarNavigationItem[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard', route: '/design-system' },
    {
      id: 'clinical-operations',
      label: 'Clinical Operations',
      icon: 'medicine-box',
      children: [
        { id: 'dashboard', label: 'Dashboard', route: '/design-system' },
        { id: 'appointments', label: 'Appointments', route: '/design-system', badge: 12 },
        { id: 'requests', label: 'Requests', route: '/design-system', badge: 4 },
        { id: 'patients', label: 'Patients', route: '/design-system' },
        { id: 'rooms', label: 'Rooms & Equipment', route: '/design-system' },
      ],
    },
    {
      id: 'people',
      label: 'People & Staff',
      icon: 'team',
      children: [
        { id: 'staff', label: 'Staff Directory', route: '/design-system' },
        { id: 'shift-planning', label: 'Shift Planning', route: '/design-system' },
        { id: 'availability', label: 'Availability', route: '/design-system' },
      ],
    },
    {
      id: 'administration',
      label: 'Administration',
      icon: 'setting',
      children: [
        { id: 'departments', label: 'Departments', route: '/design-system' },
        { id: 'locations', label: 'Locations', route: '/design-system' },
        { id: 'documents', label: 'Documents', route: '/design-system' },
      ],
    },
    {
      id: 'security',
      label: 'System & Security',
      icon: 'audit',
      children: [
        { id: 'roles', label: 'Roles & Permissions', route: '/design-system' },
        { id: 'audit-log', label: 'Audit Log', route: '/design-system' },
      ],
    },
  ];

  protected readonly appointments: readonly AppointmentRow[] = [
    {
      id: 'APT-1042',
      time: '08:30',
      patient: 'Maya Thompson',
      service: 'Cardiology review',
      clinician: 'Dr. Emilia Hart',
      location: 'Room C-12',
      status: 'confirmed',
    },
    {
      id: 'APT-1043',
      time: '09:15',
      patient: 'Noah Williams',
      service: 'Diagnostic consult',
      clinician: 'Dr. Samir Patel',
      location: 'Room B-04',
      status: 'in-progress',
    },
    {
      id: 'APT-1044',
      time: '10:00',
      patient: 'Olivia Martin',
      service: 'Follow-up visit',
      clinician: 'Dr. Emilia Hart',
      location: 'Room C-12',
      status: 'pending',
    },
    {
      id: 'APT-1045',
      time: '10:45',
      patient: 'Liam Anderson',
      service: 'Initial assessment',
      clinician: 'Dr. Chloe Reed',
      location: 'Room A-07',
      status: 'requires-attention',
    },
    {
      id: 'APT-1046',
      time: '11:30',
      patient: 'Ava Robinson',
      service: 'Care plan review',
      clinician: 'Dr. Samir Patel',
      location: 'Room B-04',
      status: 'completed',
    },
  ];

  private readonly filterToolbar = viewChild.required(OcFilterToolbar);

  protected removeFilter(id: string): void {
    this.activeFilters.update((filters) => filters.filter((filter) => filter.id !== id));
  }

  protected clearFilters(): void {
    this.activeFilters.set([]);
  }

  protected resetFilters(): void {
    this.dateRangeControl.reset();
    this.departmentControl.setValue([]);
    this.typeControl.setValue('all');
    this.statusControl.setValue([]);
    this.priorityControl.setValue('all');
    this.doctorControl.reset();
    this.roomControl.reset();
    this.urgentControl.setValue(false);
  }

  protected applyFilters(): void {
    this.activeFilters.set([
      {
        id: 'department',
        label: 'Department',
        value: this.departmentControl.value?.length ? 'Selected departments' : 'All',
      },
      {
        id: 'status',
        label: 'Status',
        value: this.statusControl.value?.length ? 'Selected statuses' : 'All',
      },
    ]);
    this.filterOpen.set(false);
    this.filterToolbar().focusAdvancedTrigger();
  }

  protected restoreFilterFocus(): void {
    this.filterToolbar().focusAdvancedTrigger();
  }

  protected demonstrateLoading(): void {
    this.loadingButton.set(true);
  }
}
