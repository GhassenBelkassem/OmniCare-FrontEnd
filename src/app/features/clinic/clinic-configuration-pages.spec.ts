import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicBootstrapResponse, ClinicPosition, ClinicResponsibility } from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { ClinicContextStore } from './clinic-context.store';
import { ClinicPositionsPage } from './clinic-positions-page';
import { ClinicPositionDetailPage } from './clinic-position-detail-page';
import { ClinicResponsibilitiesPage } from './clinic-responsibilities-page';
import { ClinicResponsibilityDetailPage } from './clinic-responsibility-detail-page';

let activeHttp!: HttpTestingController;

describe('P3-13D configuration pages', () => {
  afterEach(() => { activeHttp?.match((request) => request.url.startsWith('assets/')).forEach((r) => r.flush('<svg/>')); activeHttp?.verify(); });

  it('creates positions only for manage capability and reloads the authoritative list', () => {
    const api = fakeApi(); api.listPositions.mockReturnValue(of(positionPage())); api.createPosition.mockReturnValue(of(position()));
    const fixture = setup(ClinicPositionsPage, api, ['CLINIC_POSITION_READ', 'CLINIC_POSITION_MANAGE']);
    const page = fixture.componentInstance; expect(api.listPositions).toHaveBeenCalledWith('clinic-a', { page: 0, pageSize: 20 });
    page.name.setValue('Admissions'); page.role.setValue('CLINIC_ASSISTANT'); page.create();
    expect(api.createPosition).toHaveBeenCalledWith('clinic-a', { displayName: 'Admissions', requiredProfessionalRole: 'CLINIC_ASSISTANT', scopeType: 'CLINIC' });
    expect(api.listPositions).toHaveBeenCalledTimes(2); fixture.destroy();
  });

  it('loads active occupants, assigns by backend command, ends with expectedVersion, and hides controls without assignment manage', () => {
    const api = fakeApi(); api.getPosition.mockReturnValue(of(position())); api.listPositionAssignments.mockReturnValue(of({ contractVersion:'1',items:[assignment()],page:0,pageSize:100,hasNext:false,generatedAt:'now' })); api.listStaff.mockReturnValue(of({ contractVersion:'1',items:[{membershipId:'member-a',displayName:'Nora',professionalRole:'CLINIC_ASSISTANT',membershipStatus:'ACTIVE',joinedAt:null,suspendedAt:null,endedAt:null,version:1}],page:0,pageSize:100,hasNext:false,generatedAt:'now'})); api.createPositionAssignment.mockReturnValue(of(assignment())); api.endPositionAssignment.mockReturnValue(of({...assignment(),active:false,version:2}));
    const fixture=setup(ClinicPositionDetailPage,api,['CLINIC_POSITION_READ','CLINIC_POSITION_MANAGE','CLINIC_POSITION_ASSIGNMENT_READ','CLINIC_POSITION_ASSIGNMENT_MANAGE','CLINIC_STAFF_READ'],'position-a'); const page=fixture.componentInstance;
    expect(api.listPositionAssignments).toHaveBeenCalledWith('clinic-a',{positionId:'position-a',active:true,page:0,pageSize:100}); page.member.setValue('member-a'); page.assign(position()); expect(api.createPositionAssignment).toHaveBeenCalledWith('clinic-a',{positionId:'position-a',membershipId:'member-a'}); page.end(assignment()); expect(api.endPositionAssignment).toHaveBeenCalledWith('clinic-a','assignment-a',4); fixture.destroy();
  });

  it('creates a backend-approved responsibility from active positions and navigates only from the authoritative response', () => {
    const api=fakeApi(); api.listResponsibilities.mockReturnValue(of(responsibilityPage())); api.listPositions.mockReturnValue(of(positionPage())); api.createResponsibility.mockReturnValue(of(responsibility())); const fixture=setup(ClinicResponsibilitiesPage,api,['CLINIC_RESPONSIBILITY_READ','CLINIC_RESPONSIBILITY_MANAGE']); const page=fixture.componentInstance; page.primary.setValue('position-a');page.backup.setValue('position-b');page.escalation.setValue('position-c');page.create();
    expect(api.createResponsibility).toHaveBeenCalledWith('clinic-a',{responsibilityType:'ADMISSIONS',primaryPositionId:'position-a',backupPositionId:'position-b',escalationPositionId:'position-c'}); expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/clinic/responsibilities','responsibility-a']); fixture.destroy();
  });

  it('updates responsibility with expectedVersion and safely reloads after a stale conflict', () => {
    const api=fakeApi(); api.getResponsibility.mockReturnValue(of(responsibility())); api.listPositions.mockReturnValue(of(positionPage())); api.updateResponsibility.mockReturnValue(throwError(()=>new Error('conflict'))); const fixture=setup(ClinicResponsibilityDetailPage,api,['CLINIC_RESPONSIBILITY_READ','CLINIC_RESPONSIBILITY_MANAGE'],'responsibility-a');const page=fixture.componentInstance;page.primary.setValue('position-b');page.save(responsibility());expect(api.updateResponsibility).toHaveBeenCalledWith('clinic-a','responsibility-a',{primaryPositionId:'position-b',backupPositionId:null,escalationPositionId:null,expectedVersion:7});expect(page.error()).toContain('latest information');expect(api.getResponsibility).toHaveBeenCalledTimes(2);fixture.destroy();
  });

  it('submits each valid distinct responsibility position combination with the existing create payload', () => {
    const api=fakeApi();api.listResponsibilities.mockReturnValue(of(responsibilityPage()));api.listPositions.mockReturnValue(of(positionPage()));api.createResponsibility.mockReturnValue(of(responsibility()));const fixture=setup(ClinicResponsibilitiesPage,api,['CLINIC_RESPONSIBILITY_READ','CLINIC_RESPONSIBILITY_MANAGE']);const page=fixture.componentInstance;
    for(const [primaryPositionId,backupPositionId,escalationPositionId] of [['position-a',null,null],['position-a','position-b',null],['position-a','position-b','position-c']] as const){page.primary.setValue(primaryPositionId);page.backup.setValue(backupPositionId);page.escalation.setValue(escalationPositionId);expect(page.hasDuplicatePositions()).toBe(false);page.create();expect(api.createResponsibility).toHaveBeenLastCalledWith('clinic-a',{responsibilityType:'ADMISSIONS',primaryPositionId,backupPositionId,escalationPositionId});}
    fixture.destroy();
  });

  it('prevents duplicate responsibility positions from submitting on create', () => {
    const createApi=fakeApi();createApi.listResponsibilities.mockReturnValue(of(responsibilityPage()));createApi.listPositions.mockReturnValue(of(positionPage()));const createFixture=setup(ClinicResponsibilitiesPage,createApi,['CLINIC_RESPONSIBILITY_READ','CLINIC_RESPONSIBILITY_MANAGE']);const createPage=createFixture.componentInstance;
    for(const [primaryPositionId,backupPositionId,escalationPositionId] of [['position-a','position-a',null],['position-a',null,'position-a'],['position-a','position-b','position-b']] as const){createPage.primary.setValue(primaryPositionId);createPage.backup.setValue(backupPositionId);createPage.escalation.setValue(escalationPositionId);expect(createPage.hasDuplicatePositions()).toBe(true);createPage.create();}
    expect(createApi.createResponsibility).not.toHaveBeenCalled();createFixture.destroy();
  });

  it('prevents duplicate responsibility positions from submitting on update', () => {
    const api=fakeApi();api.getResponsibility.mockReturnValue(of(responsibility()));api.listPositions.mockReturnValue(of(positionPage()));const fixture=setup(ClinicResponsibilityDetailPage,api,['CLINIC_RESPONSIBILITY_READ','CLINIC_RESPONSIBILITY_MANAGE'],'responsibility-a');const page=fixture.componentInstance;
    for(const [primaryPositionId,backupPositionId,escalationPositionId] of [['position-a','position-a',null],['position-a',null,'position-a'],['position-a','position-b','position-b']] as const){page.primary.setValue(primaryPositionId);page.backup.setValue(backupPositionId);page.escalation.setValue(escalationPositionId);expect(page.hasDuplicatePositions()).toBe(true);page.save(responsibility());}
    expect(api.updateResponsibility).not.toHaveBeenCalled();fixture.destroy();
  });

  it('updates valid distinct responsibility positions with the existing versioned payload', () => {
    const api=fakeApi();api.getResponsibility.mockReturnValue(of(responsibility()));api.listPositions.mockReturnValue(of(positionPage()));api.updateResponsibility.mockReturnValue(of(responsibility()));const fixture=setup(ClinicResponsibilityDetailPage,api,['CLINIC_RESPONSIBILITY_READ','CLINIC_RESPONSIBILITY_MANAGE'],'responsibility-a');const page=fixture.componentInstance;
    for(const [primaryPositionId,backupPositionId,escalationPositionId] of [['position-a',null,null],['position-a','position-b',null],['position-a','position-b','position-c']] as const){page.primary.setValue(primaryPositionId);page.backup.setValue(backupPositionId);page.escalation.setValue(escalationPositionId);expect(page.hasDuplicatePositions()).toBe(false);page.save(responsibility());expect(api.updateResponsibility).toHaveBeenLastCalledWith('clinic-a','responsibility-a',{primaryPositionId,backupPositionId,escalationPositionId,expectedVersion:7});}
    fixture.destroy();
  });

  it('keeps position mutation controls out of read-only configuration views', () => {
    const api=fakeApi();api.listPositions.mockReturnValue(of(positionPage()));const fixture=setup(ClinicPositionsPage,api,['CLINIC_POSITION_READ']);expect(text(fixture)).not.toContain('Create position');fixture.destroy();
  });
  it('keeps responsibility mutation controls out of read-only configuration views', () => {
    const api=fakeApi();api.listResponsibilities.mockReturnValue(of(responsibilityPage()));const fixture=setup(ClinicResponsibilitiesPage,api,['CLINIC_RESPONSIBILITY_READ']);expect(text(fixture)).not.toContain('Create responsibility');fixture.destroy();
  });
});

function setup(component: any, api: any, capabilities: ClinicBootstrapResponse['capabilities'], id?: string): ComponentFixture<any> { TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:Router,useValue:{navigate:vi.fn().mockResolvedValue(true)}},{provide:RUNTIME_CONFIG,useValue:{apiBaseUrl:'/api/v1'}},{provide:ClinicApiService,useValue:api},{provide:ClinicContextStore,useValue:{initialize:vi.fn(),selectedClinicId:signal('clinic-a'),bootstrap:signal(bootstrap(capabilities))}},{provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({positionId:id,responsibilityId:id})},paramMap:of(convertToParamMap({positionId:id,responsibilityId:id}))}}]});activeHttp=TestBed.inject(HttpTestingController);const fixture=TestBed.createComponent(component);fixture.detectChanges();return fixture; }
function fakeApi(): any{return {listPositions:vi.fn(),createPosition:vi.fn(),getPosition:vi.fn(),listPositionAssignments:vi.fn(),listStaff:vi.fn(),createPositionAssignment:vi.fn(),endPositionAssignment:vi.fn(),listResponsibilities:vi.fn(),createResponsibility:vi.fn(),getResponsibility:vi.fn(),updateResponsibility:vi.fn()};}
function text(fixture:ComponentFixture<any>):string{return fixture.nativeElement.textContent??'';}
function bootstrap(capabilities:ClinicBootstrapResponse['capabilities']):ClinicBootstrapResponse{return {contractVersion:'1',clinic:{clinicId:'clinic-a',clinicName:'A',clinicStatus:'ACTIVE'},membership:{membershipId:'member-a',membershipStatus:'ACTIVE',professionalRole:'CLINIC_ADMIN',version:1},capabilities,featureFlags:{},resolvedAt:'now'};}
function position(overrides:Partial<ClinicPosition>={}):ClinicPosition{return {id:'position-a',displayName:'Admissions',requiredProfessionalRole:'CLINIC_ASSISTANT',scopeType:'CLINIC',active:true,version:3,createdAt:'now',updatedAt:'now',...overrides};} function positionPage(){return {contractVersion:'1',items:[position(),position({id:'position-b',displayName:'Backup'}),position({id:'position-c',displayName:'Escalation'})],page:0,pageSize:20,hasNext:false,generatedAt:'now'};} function assignment(){return {id:'assignment-a',positionId:'position-a',membershipId:'member-a',assignedAt:'now',endedAt:null,active:true,version:4,createdAt:'now',updatedAt:'now'};} function responsibility(overrides:Partial<ClinicResponsibility>={}):ClinicResponsibility{return {id:'responsibility-a',responsibilityType:'ADMISSIONS',scopeType:'CLINIC',primaryPositionId:'position-a',backupPositionId:null,escalationPositionId:null,active:true,version:7,createdAt:'now',updatedAt:'now',...overrides};}function responsibilityPage(){return {contractVersion:'1',items:[responsibility()],page:0,pageSize:20,hasNext:false,generatedAt:'now'};}
