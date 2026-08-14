import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicBootstrapResponse, ClinicRoutingIncident } from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicRoutingIncidentsPage } from './clinic-routing-incidents-page';

describe('ClinicRoutingIncidentsPage', () => {
  let fixture: ComponentFixture<ClinicRoutingIncidentsPage>; let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:RUNTIME_CONFIG,useValue:{apiBaseUrl:'/api/v1'}},{provide:ClinicContextStore,useValue:{initialize:vi.fn(),selectedClinicId:signal('clinic-a'),bootstrap:signal(bootstrap())}}]});http=TestBed.inject(HttpTestingController);fixture=TestBed.createComponent(ClinicRoutingIncidentsPage);fixture.detectChanges(); });
  afterEach(()=>{http.match((request) => request.url.startsWith('assets/')).forEach((request) => request.flush('<svg></svg>'));fixture.destroy();http.verify();});
  it('loads Open incidents through the server query and supports status/type/page filters',()=>{
    let request=http.expectOne('/api/v1/clinics/clinic-a/routing-incidents?status=OPEN&page=0&size=20');request.flush(page());
    fixture.componentInstance.setStatus('RESOLVED');request=http.expectOne('/api/v1/clinics/clinic-a/routing-incidents?status=RESOLVED&page=0&size=20');request.flush(page());
    fixture.componentInstance.setType('TASK_COMPLETION_OVERDUE');request=http.expectOne('/api/v1/clinics/clinic-a/routing-incidents?status=RESOLVED&type=TASK_COMPLETION_OVERDUE&page=0&size=20');request.flush(page());
    fixture.componentInstance.go(1);request=http.expectOne('/api/v1/clinics/clinic-a/routing-incidents?status=RESOLVED&type=TASK_COMPLETION_OVERDUE&page=1&size=20');request.flush(page());
  });
  it('never exposes retry for task completion overdue and refetches after retry',()=>{
    const overdue=incident({incidentType:'TASK_COMPLETION_OVERDUE'});http.expectOne('/api/v1/clinics/clinic-a/routing-incidents?status=OPEN&page=0&size=20').flush(page([overdue]));expect(fixture.componentInstance.canRetry(overdue)).toBe(false);
    const retryable=incident();expect(fixture.componentInstance.canRetry(retryable)).toBe(true);fixture.componentInstance.retry(retryable);http.expectOne('/api/v1/clinics/clinic-a/routing-incidents/incident-a/retry').flush(retryable);http.expectOne('/api/v1/clinics/clinic-a/routing-incidents?status=OPEN&page=0&size=20').flush(page());
  });
});
function bootstrap():ClinicBootstrapResponse{return {contractVersion:'1',clinic:{clinicId:'clinic-a',clinicName:'A',clinicStatus:'ACTIVE'},membership:{membershipId:'member-a',membershipStatus:'ACTIVE',professionalRole:'CLINIC_ADMIN',version:1},capabilities:['CLINIC_ROUTING_INCIDENT_READ','CLINIC_ROUTING_INCIDENT_RETRY'],featureFlags:{},resolvedAt:'2026-08-12T00:00:00Z'};}
function incident(overrides:Partial<ClinicRoutingIncident>={}) :ClinicRoutingIncident{return {id:'incident-a',taskId:'task-a',caseId:'case-a',incidentType:'MISSING_ACTIVE_RESPONSIBILITY',status:'OPEN',openedAt:'2026-08-12T00:00:00Z',lastObservedAt:'2026-08-12T00:00:00Z',resolvedAt:null,resolutionCode:null,version:1,...overrides};}
function page(items:readonly ClinicRoutingIncident[]=[]){return {items,page:0,pageSize:20,hasNext:false,generatedAt:'2026-08-12T00:00:00Z'};}
