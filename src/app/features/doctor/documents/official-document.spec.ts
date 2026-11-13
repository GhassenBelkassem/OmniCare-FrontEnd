import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import type { ScheduledCareEvent } from '../../../core/realtime/live-event.models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ArtifactApiService } from '../artifact-api.service';
import { PatientChartApiService } from '../patient-chart/patient-chart-api.service';
import { DOCUMENT_ACCESS_REQUIRED, DOCUMENT_DOWNLOAD_ERROR, DOCUMENT_PREPARING, OfficialDocument } from './official-document';

const forbidden = () => new HttpErrorResponse({ status: 403, error: { code: 'PATIENT_CHART_CLINICAL_ACCESS_REQUIRED' } });

describe('OfficialDocument (G-1 D5: one « Télécharger » everywhere)', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(inputs: { ready?: boolean; templateFallback?: boolean; chartId?: string | null } = {}) {
    const events = new Subject<ScheduledCareEvent>();
    const artifacts = { download: vi.fn(() => of(new Blob(['%PDF']))) };
    const chart = { downloadArtifact: vi.fn(() => of(new Blob(['%PDF']))) };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(OMNICARE_ICONS),
        { provide: RealtimeService, useValue: { scheduledCareEvents$: events } },
        { provide: ArtifactApiService, useValue: artifacts },
        { provide: PatientChartApiService, useValue: chart },
      ],
    });
    const fixture = TestBed.createComponent(OfficialDocument);
    fixture.componentRef.setInput('consultationId', 'consultation-1');
    fixture.componentRef.setInput('artifactId', 'artifact-1');
    fixture.componentRef.setInput('title', 'Arrêt de travail');
    fixture.componentRef.setInput('ready', inputs.ready ?? true);
    fixture.componentRef.setInput('templateFallback', inputs.templateFallback ?? false);
    fixture.componentRef.setInput('chartId', inputs.chartId === undefined ? 'chart-1' : inputs.chartId);
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    return { fixture, events, artifacts, chart, text, component: fixture.componentInstance };
  }

  it('shows « En préparation… » until the server announces the document, then « Télécharger » on its own', () => {
    const { fixture, events, component, text } = render({ ready: false });
    const ready: string[] = [];
    component.becameReady.subscribe((id) => ready.push(id));
    expect(text()).toContain(DOCUMENT_PREPARING);
    expect(component.isReady()).toBe(false);

    events.next({ eventId: 'e1', eventType: 'DOCUMENT_READY', resourceType: 'ARTIFACT', resourceId: 'other', version: 1, occurredAt: 'x' });
    expect(component.isReady()).toBe(false);
    events.next({ eventId: 'e2', eventType: 'DOCUMENT_READY', resourceType: 'ARTIFACT', resourceId: 'artifact-1', version: 1, occurredAt: 'x' });
    fixture.detectChanges();
    expect(component.isReady()).toBe(true);
    expect(text()).not.toContain(DOCUMENT_PREPARING);
    expect(ready).toEqual(['artifact-1']);
  });

  it('downloads through the doctor route and tells when the standard layout was used', () => {
    const { component, artifacts, chart, text } = render({ templateFallback: true });
    expect(text()).toContain('Document généré sur le modèle standard.');
    component.download();
    expect(artifacts.download).toHaveBeenCalledWith('consultation-1', 'artifact-1');
    expect(chart.downloadArtifact).not.toHaveBeenCalled();
  });

  it('falls back to the chart route when refused, then shows « Accès requis » (never an error)', () => {
    const { fixture, component, artifacts, chart, text } = render();
    artifacts.download.mockReturnValue(throwError(forbidden));
    component.download();
    expect(chart.downloadArtifact).toHaveBeenCalledWith('chart-1', 'consultation-1', 'artifact-1');
    expect(component.accessRequired()).toBe(false);

    chart.downloadArtifact.mockReturnValue(throwError(forbidden));
    component.download();
    fixture.detectChanges();
    expect(component.accessRequired()).toBe(true);
    expect(component.error()).toBeNull();
    expect(text()).toContain(DOCUMENT_ACCESS_REQUIRED);
  });

  it('any other failure: a French message and « Réessayer », which tries again', () => {
    const { fixture, component, artifacts, text } = render({ chartId: null });
    artifacts.download.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    component.download();
    fixture.detectChanges();
    expect(text()).toContain(DOCUMENT_DOWNLOAD_ERROR);
    expect(text()).toContain('Réessayer');

    artifacts.download.mockReturnValue(of(new Blob(['%PDF'])));
    component.download();
    expect(component.error()).toBeNull();
    expect(artifacts.download).toHaveBeenCalledTimes(2);
  });
});
