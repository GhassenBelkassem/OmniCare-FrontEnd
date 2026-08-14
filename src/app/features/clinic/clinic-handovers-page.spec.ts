import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicBootstrapResponse, ClinicTaskHandover } from './clinic-api.models';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicHandoversPage } from './clinic-handovers-page';

describe('ClinicHandoversPage',()=>{
  let fixture:ComponentFixture<ClinicHandoversPage>;let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:RUNTIME_CONFIG,useValue:{apiBaseUrl:'/api/v1'}},{provide:ClinicContextStore,useValue:{initialize:vi.fn(),selectedClinicId:signal('clinic-a'),bootstrap:signal(bootstrap())}}]});http=TestBed.inject(HttpTestingController);fixture=TestBed.createComponent(ClinicHandoversPage);fixture.detectChanges();});afterEach(()=>{http.match((request) => request.url.startsWith('assets/')).forEach((request) => request.flush('<svg></svg>'));fixture.destroy();http.verify();});
  it('loads incoming/outgoing Slice pages and executes target accept',()=>{http.expectOne('/api/v1/clinics/clinic-a/task-handovers/incoming?page=0&pageSize=20').flush(page([handover()]));fixture.componentInstance.setView('outgoing');http.expectOne('/api/v1/clinics/clinic-a/task-handovers/outgoing?page=0&pageSize=20').flush(page([handover()]));fixture.componentInstance.setView('incoming');http.expectOne('/api/v1/clinics/clinic-a/task-handovers/incoming?page=0&pageSize=20').flush(page([handover()]));fixture.componentInstance.accept(handover());http.expectOne('/api/v1/clinics/clinic-a/task-handovers/handover-a/accept').flush(handover({status:'ACCEPTED'}));http.expectOne('/api/v1/clinics/clinic-a/task-handovers/incoming?page=0&pageSize=20').flush(page());});
  it('keeps invalidated handovers read-only',()=>{const invalidated=handover({status:'INVALIDATED',invalidationReason:'TASK_TERMINAL'});http.expectOne('/api/v1/clinics/clinic-a/task-handovers/incoming?page=0&pageSize=20').flush(page([invalidated]));expect(fixture.componentInstance.canAccept(invalidated)).toBe(false);expect(fixture.componentInstance.canCancel(invalidated)).toBe(false);});
});
function bootstrap():ClinicBootstrapResponse{return {contractVersion:'1',clinic:{clinicId:'clinic-a',clinicName:'A',clinicStatus:'ACTIVE'},membership:{membershipId:'member-a',membershipStatus:'ACTIVE',professionalRole:'CLINIC_ASSISTANT',version:1},capabilities:['CLINIC_TASK_HANDOVER'],featureFlags:{},resolvedAt:'2026-08-12T00:00:00Z'};}
function handover(overrides:Partial<ClinicTaskHandover>={}):ClinicTaskHandover{return {handoverId:'handover-a',taskId:'task-a',status:'PENDING',reasonCode:'SHIFT_CHANGE',fromMembershipId:'member-a',toMembershipId:'member-b',taskType:'ADMINISTRATIVE_REVIEW',priority:'NORMAL',initiatedAt:'2026-08-12T00:00:00Z',acceptedAt:null,declinedAt:null,cancelledAt:null,invalidatedAt:null,invalidationReason:null,...overrides};}
function page(items:readonly ClinicTaskHandover[]=[]){return {items,page:0,pageSize:20,hasNext:false,generatedAt:'2026-08-12T00:00:00Z'};}
