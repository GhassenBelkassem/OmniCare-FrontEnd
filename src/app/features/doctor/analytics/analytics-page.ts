import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import {
  OcPageHeader,
  OcCard,
  OcMetricCard,
  OcSegmentedControl,
} from '../../../shared/ui';

interface DailyConsultations {
  readonly day: string;
  readonly count: number;
}

interface DemographicGroup {
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
  readonly color: string;
}

interface RevenueEntry {
  readonly label: string;
  readonly amount: number;
}

@Component({
  selector: 'app-analytics-page',
  templateUrl: './analytics-page.html',
  styleUrls: ['./analytics-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OcPageHeader, OcCard, OcMetricCard, OcSegmentedControl],
})
export class AnalyticsPage {
  readonly selectedPeriod = signal('week');

  readonly periodOptions = [
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' },
    { value: 'year', label: 'Ann\u00e9e' },
  ] as const;

  readonly consultationsWeek: readonly DailyConsultations[] = [
    { day: 'Lun', count: 12 },
    { day: 'Mar', count: 8 },
    { day: 'Mer', count: 15 },
    { day: 'Jeu', count: 10 },
    { day: 'Ven', count: 18 },
    { day: 'Sam', count: 6 },
    { day: 'Dim', count: 0 },
  ];

  readonly consultationsMonth: readonly DailyConsultations[] = [
    { day: 'S1', count: 52 },
    { day: 'S2', count: 61 },
    { day: 'S3', count: 48 },
    { day: 'S4', count: 70 },
  ];

  readonly consultationsYear: readonly DailyConsultations[] = [
    { day: 'Jan', count: 210 },
    { day: 'F\u00e9v', count: 195 },
    { day: 'Mar', count: 230 },
    { day: 'Avr', count: 245 },
    { day: 'Mai', count: 260 },
    { day: 'Jun', count: 180 },
    { day: 'Jul', count: 150 },
    { day: 'Ao\u00fb', count: 175 },
    { day: 'Sep', count: 220 },
    { day: 'Oct', count: 240 },
    { day: 'Nov', count: 255 },
    { day: 'D\u00e9c', count: 200 },
  ];

  readonly demographics: readonly DemographicGroup[] = [
    { label: '0\u201317', count: 28, percentage: 14, color: 'var(--oc-color-info)' },
    { label: '18\u201335', count: 64, percentage: 32, color: 'var(--oc-color-primary)' },
    { label: '36\u201355', count: 72, percentage: 36, color: 'var(--oc-color-success)' },
    { label: '56+', count: 36, percentage: 18, color: 'var(--oc-color-warning)' },
  ];

  readonly revenueWeek: readonly RevenueEntry[] = [
    { label: 'Lun', amount: 960 },
    { label: 'Mar', amount: 640 },
    { label: 'Mer', amount: 1200 },
    { label: 'Jeu', amount: 800 },
    { label: 'Ven', amount: 1440 },
    { label: 'Sam', amount: 480 },
    { label: 'Dim', amount: 0 },
  ];

  readonly revenueMonth: readonly RevenueEntry[] = [
    { label: 'S1', amount: 4160 },
    { label: 'S2', amount: 4880 },
    { label: 'S3', amount: 3840 },
    { label: 'S4', amount: 5600 },
  ];

  readonly revenueYear: readonly RevenueEntry[] = [
    { label: 'Jan', amount: 16800 },
    { label: 'F\u00e9v', amount: 15600 },
    { label: 'Mar', amount: 18400 },
    { label: 'Avr', amount: 19600 },
    { label: 'Mai', amount: 20800 },
    { label: 'Jun', amount: 14400 },
    { label: 'Jul', amount: 12000 },
    { label: 'Ao\u00fb', amount: 14000 },
    { label: 'Sep', amount: 17600 },
    { label: 'Oct', amount: 19200 },
    { label: 'Nov', amount: 20400 },
    { label: 'D\u00e9c', amount: 16000 },
  ];

  readonly currentConsultations = computed(() => {
    const period = this.selectedPeriod();
    if (period === 'month') return this.consultationsMonth;
    if (period === 'year') return this.consultationsYear;
    return this.consultationsWeek;
  });

  readonly currentRevenue = computed(() => {
    const period = this.selectedPeriod();
    if (period === 'month') return this.revenueMonth;
    if (period === 'year') return this.revenueYear;
    return this.revenueWeek;
  });

  readonly weekConsultations = computed(() =>
    this.consultationsWeek.reduce((sum, d) => sum + d.count, 0),
  );

  readonly newPatientsCount = computed(() => 24);

  readonly totalRevenue = computed(() =>
    this.currentRevenue().reduce((sum, r) => sum + r.amount, 0),
  );

  readonly utilization = computed(() => '78%');

  readonly totalDemographicCount = computed(() =>
    this.demographics.reduce((sum, g) => sum + g.count, 0),
  );

  readonly maxConsultationCount = computed(() =>
    Math.max(...this.currentConsultations().map((d) => d.count), 1),
  );

  readonly maxRevenue = computed(() =>
    Math.max(...this.currentRevenue().map((r) => r.amount), 1),
  );

  readonly donutGradient = computed(() => {
    let accumulated = 0;
    const stops: string[] = [];
    for (const group of this.demographics) {
      const start = accumulated;
      accumulated += group.percentage;
      stops.push(`${group.color} ${start}% ${accumulated}%`);
    }
    return `conic-gradient(${stops.join(', ')})`;
  });

  consultationBarHeight(count: number): string {
    return `${(count / this.maxConsultationCount()) * 100}%`;
  }

  revenueBarHeight(amount: number): string {
    return `${(amount / this.maxRevenue()) * 100}%`;
  }
}
