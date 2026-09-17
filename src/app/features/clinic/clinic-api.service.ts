import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  ClinicBootstrapResponse,
  ClinicCaseDeclineRequest,
  ClinicCaseDetail,
  ClinicCaseInformationRequiredRequest,
  ClinicCaseQuery,
  ClinicCaseQueueResponse,
  ClinicCaseTransitionRequest,
  ClinicStaffInvitationRequest,
  ClinicStaffLifecycleRequest,
  ClinicStaffMember,
  ClinicStaffPage,
  ClinicStaffQuery,
  ClinicStaffSuspendRequest,
  ClinicPositionPage,
  ClinicPosition,
  ClinicPositionCreateRequest,
  ClinicPositionQuery,
  ClinicPositionUpdateRequest,
  ClinicPositionAssignment,
  ClinicPositionAssignmentCreateRequest,
  ClinicPositionAssignmentPage,
  ClinicPositionAssignmentQuery,
  ClinicResponsibility,
  ClinicResponsibilityCreateRequest,
  ClinicResponsibilityPage,
  ClinicResponsibilityQuery,
  ClinicResponsibilityUpdateRequest,
  ClinicRoutingIncident,
  ClinicRoutingIncidentPage,
  ClinicRoutingIncidentQuery,
  ClinicTaskHandover,
  ClinicTaskHandoverPage,
  ClinicTaskHandoverRequest,
  ClinicTaskHandoverTargetPage,
  ClinicTaskBlockRequest,
  ClinicTaskDetail,
  ClinicTaskPage,
  ClinicTaskQuery,
  ClinicTaskReassignmentRequest,
  ClinicTaskVersionRequest,
  MeAccessResponse,
  MeClinicsResponse,
} from './clinic-api.models';

@Injectable({ providedIn: 'root' })
export class ClinicApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  getAccess(): Observable<MeAccessResponse> {
    return this.http.get<MeAccessResponse>(`${this.config.apiBaseUrl}/me/access`);
  }

  getClinics(): Observable<MeClinicsResponse> {
    return this.http.get<MeClinicsResponse>(`${this.config.apiBaseUrl}/me/clinics`);
  }

  getBootstrap(clinicId: string): Observable<ClinicBootstrapResponse> {
    return this.http.get<ClinicBootstrapResponse>(`${this.staffBase(clinicId, '/bootstrap')}`);
  }

  /** Server-side paged, filtered and searched. The client never pages through everything. */
  listStaff(clinicId: string, query: ClinicStaffQuery = {}): Observable<ClinicStaffPage> {
    let params = new HttpParams();
    if (query.status !== undefined) params = params.set('status', query.status);
    if (query.professionalRole !== undefined) {
      params = params.set('professionalRole', query.professionalRole);
    }
    if (query.search !== undefined && query.search.length > 0) {
      params = params.set('search', query.search);
    }
    if (query.page !== undefined) params = params.set('page', String(query.page));
    if (query.pageSize !== undefined) params = params.set('pageSize', String(query.pageSize));
    return this.http.get<ClinicStaffPage>(this.staffBase(clinicId, '/staff'), { params });
  }

  listCases(clinicId: string, query: ClinicCaseQuery = {}): Observable<ClinicCaseQueueResponse> {
    let params = new HttpParams();
    if (query.statuses !== undefined && query.statuses.length > 0) {
      params = params.set('statuses', query.statuses.join(','));
    }
    if (query.page !== undefined) params = params.set('page', String(query.page));
    if (query.pageSize !== undefined) params = params.set('pageSize', String(query.pageSize));
    return this.http.get<ClinicCaseQueueResponse>(this.caseBase(clinicId), { params });
  }

  getCase(clinicId: string, caseId: string): Observable<ClinicCaseDetail> {
    return this.http.get<ClinicCaseDetail>(this.caseUrl(clinicId, caseId));
  }

  startReview(
    clinicId: string,
    caseId: string,
    request: ClinicCaseTransitionRequest,
  ): Observable<ClinicCaseDetail> {
    return this.http.post<ClinicCaseDetail>(
      `${this.caseUrl(clinicId, caseId)}/review/start`,
      request,
    );
  }

  requestInformation(
    clinicId: string,
    caseId: string,
    request: ClinicCaseInformationRequiredRequest,
  ): Observable<ClinicCaseDetail> {
    return this.http.post<ClinicCaseDetail>(
      `${this.caseUrl(clinicId, caseId)}/information-required`,
      request,
    );
  }

  readyForPlanning(
    clinicId: string,
    caseId: string,
    request: ClinicCaseTransitionRequest,
  ): Observable<ClinicCaseDetail> {
    return this.http.post<ClinicCaseDetail>(
      `${this.caseUrl(clinicId, caseId)}/ready-for-planning`,
      request,
    );
  }

  declineCase(
    clinicId: string,
    caseId: string,
    request: ClinicCaseDeclineRequest,
  ): Observable<ClinicCaseDetail> {
    return this.http.post<ClinicCaseDetail>(`${this.caseUrl(clinicId, caseId)}/decline`, request);
  }

  getStaffMember(clinicId: string, membershipId: string): Observable<ClinicStaffMember> {
    return this.http.get<ClinicStaffMember>(this.staffMemberUrl(clinicId, membershipId));
  }

  attachProfessional(
    clinicId: string,
    request: ClinicStaffInvitationRequest,
  ): Observable<ClinicStaffMember> {
    return this.http.post<ClinicStaffMember>(
      `${this.staffBase(clinicId, '/staff')}/invitations`,
      request,
    );
  }

  suspendStaffMember(
    clinicId: string,
    membershipId: string,
    request: ClinicStaffSuspendRequest,
  ): Observable<ClinicStaffMember> {
    return this.http.post<ClinicStaffMember>(
      `${this.staffMemberUrl(clinicId, membershipId)}/suspend`,
      request,
    );
  }

  reactivateStaffMember(
    clinicId: string,
    membershipId: string,
    request: ClinicStaffLifecycleRequest,
  ): Observable<ClinicStaffMember> {
    return this.http.post<ClinicStaffMember>(
      `${this.staffMemberUrl(clinicId, membershipId)}/reactivate`,
      request,
    );
  }

  endStaffMember(
    clinicId: string,
    membershipId: string,
    request: ClinicStaffLifecycleRequest,
  ): Observable<ClinicStaffMember> {
    return this.http.post<ClinicStaffMember>(
      `${this.staffMemberUrl(clinicId, membershipId)}/end`,
      request,
    );
  }

  listPositionQueue(clinicId: string, query: ClinicTaskQuery = {}): Observable<ClinicTaskPage> {
    return this.http.get<ClinicTaskPage>(`${this.taskBase(clinicId)}/position-queue`, {
      params: this.taskParams(query),
    });
  }

  listMyTasks(clinicId: string, query: ClinicTaskQuery = {}): Observable<ClinicTaskPage> {
    return this.http.get<ClinicTaskPage>(`${this.taskBase(clinicId)}/my`, {
      params: this.taskParams(query),
    });
  }

  getTask(clinicId: string, taskId: string): Observable<ClinicTaskDetail> {
    return this.http.get<ClinicTaskDetail>(this.taskUrl(clinicId, taskId));
  }

  acknowledgeTask(
    clinicId: string,
    taskId: string,
    request: ClinicTaskVersionRequest,
  ): Observable<ClinicTaskDetail> {
    return this.http.post<ClinicTaskDetail>(
      `${this.taskUrl(clinicId, taskId)}/acknowledge`,
      request,
    );
  }

  startTask(
    clinicId: string,
    taskId: string,
    request: ClinicTaskVersionRequest,
  ): Observable<ClinicTaskDetail> {
    return this.http.post<ClinicTaskDetail>(`${this.taskUrl(clinicId, taskId)}/start`, request);
  }

  reassignTask(
    clinicId: string,
    taskId: string,
    request: ClinicTaskReassignmentRequest,
  ): Observable<ClinicTaskDetail> {
    return this.http.post<ClinicTaskDetail>(`${this.taskUrl(clinicId, taskId)}/reassign`, request);
  }

  blockTask(
    clinicId: string,
    taskId: string,
    request: ClinicTaskBlockRequest,
  ): Observable<ClinicTaskDetail> {
    return this.http.post<ClinicTaskDetail>(`${this.taskUrl(clinicId, taskId)}/block`, request);
  }

  unblockTask(
    clinicId: string,
    taskId: string,
    request: ClinicTaskVersionRequest,
  ): Observable<ClinicTaskDetail> {
    return this.http.post<ClinicTaskDetail>(`${this.taskUrl(clinicId, taskId)}/unblock`, request);
  }

  completeTask(
    clinicId: string,
    taskId: string,
    request: ClinicTaskVersionRequest,
  ): Observable<ClinicTaskDetail> {
    return this.http.post<ClinicTaskDetail>(`${this.taskUrl(clinicId, taskId)}/complete`, request);
  }

  listRoutingIncidents(
    clinicId: string,
    query: ClinicRoutingIncidentQuery = {},
  ): Observable<ClinicRoutingIncidentPage> {
    let params = new HttpParams();
    if (query.status !== undefined) params = params.set('status', query.status);
    if (query.type !== undefined) params = params.set('type', query.type);
    if (query.page !== undefined) params = params.set('page', String(query.page));
    if (query.size !== undefined) params = params.set('size', String(query.size));
    return this.http.get<ClinicRoutingIncidentPage>(this.staffBase(clinicId, '/routing-incidents'), {
      params,
    });
  }

  getRoutingIncident(clinicId: string, incidentId: string): Observable<ClinicRoutingIncident> {
    return this.http.get<ClinicRoutingIncident>(
      `${this.staffBase(clinicId, '/routing-incidents')}/${encodeURIComponent(incidentId)}`,
    );
  }

  retryRoutingIncident(clinicId: string, incidentId: string): Observable<ClinicRoutingIncident> {
    return this.http.post<ClinicRoutingIncident>(
      `${this.staffBase(clinicId, '/routing-incidents')}/${encodeURIComponent(incidentId)}/retry`,
      {},
    );
  }

  listIncomingHandovers(
    clinicId: string,
    page = 0,
    pageSize = 20,
  ): Observable<ClinicTaskHandoverPage> {
    return this.listHandovers(clinicId, 'incoming', page, pageSize);
  }

  listOutgoingHandovers(
    clinicId: string,
    page = 0,
    pageSize = 20,
  ): Observable<ClinicTaskHandoverPage> {
    return this.listHandovers(clinicId, 'outgoing', page, pageSize);
  }

  getHandover(clinicId: string, handoverId: string): Observable<ClinicTaskHandover> {
    return this.http.get<ClinicTaskHandover>(
      `${this.staffBase(clinicId, '/task-handovers')}/${encodeURIComponent(handoverId)}`,
    );
  }

  listHandoverTargets(
    clinicId: string,
    taskId: string,
    page = 0,
    size = 20,
  ): Observable<ClinicTaskHandoverTargetPage> {
    return this.http.get<ClinicTaskHandoverTargetPage>(
      `${this.taskUrl(clinicId, taskId)}/handover-targets`,
      { params: new HttpParams().set('page', String(page)).set('size', String(size)) },
    );
  }

  initiateHandover(
    clinicId: string,
    taskId: string,
    request: ClinicTaskHandoverRequest,
  ): Observable<ClinicTaskHandover> {
    return this.http.post<ClinicTaskHandover>(`${this.taskUrl(clinicId, taskId)}/handovers`, request);
  }

  acceptHandover(clinicId: string, handoverId: string): Observable<ClinicTaskHandover> {
    return this.handoverCommand(clinicId, handoverId, 'accept');
  }

  declineHandover(clinicId: string, handoverId: string): Observable<ClinicTaskHandover> {
    return this.handoverCommand(clinicId, handoverId, 'decline');
  }

  cancelHandover(clinicId: string, handoverId: string): Observable<ClinicTaskHandover> {
    return this.handoverCommand(clinicId, handoverId, 'cancel');
  }

  listActivePositions(clinicId: string): Observable<ClinicPositionPage> {
    return this.http.get<ClinicPositionPage>(this.staffBase(clinicId, '/positions'), {
      params: new HttpParams().set('active', 'true').set('page', '0').set('pageSize', '100'),
    });
  }

  listPositions(clinicId: string, query: ClinicPositionQuery = {}): Observable<ClinicPositionPage> { let params=new HttpParams();if(query.active!==undefined)params=params.set('active',String(query.active));if(query.page!==undefined)params=params.set('page',String(query.page));if(query.pageSize!==undefined)params=params.set('pageSize',String(query.pageSize));return this.http.get<ClinicPositionPage>(this.staffBase(clinicId,'/positions'),{params}); }
  getPosition(clinicId:string,positionId:string):Observable<ClinicPosition>{return this.http.get<ClinicPosition>(`${this.staffBase(clinicId,'/positions')}/${encodeURIComponent(positionId)}`);}
  createPosition(clinicId:string,request:ClinicPositionCreateRequest):Observable<ClinicPosition>{return this.http.post<ClinicPosition>(this.staffBase(clinicId,'/positions'),request);}
  updatePosition(clinicId:string,positionId:string,request:ClinicPositionUpdateRequest):Observable<ClinicPosition>{return this.http.put<ClinicPosition>(`${this.staffBase(clinicId,'/positions')}/${encodeURIComponent(positionId)}`,request);}
  deactivatePosition(clinicId:string,positionId:string,expectedVersion:number):Observable<ClinicPosition>{return this.http.post<ClinicPosition>(`${this.staffBase(clinicId,'/positions')}/${encodeURIComponent(positionId)}/deactivate`,{expectedVersion});}
  reactivatePosition(clinicId:string,positionId:string,expectedVersion:number):Observable<ClinicPosition>{return this.http.post<ClinicPosition>(`${this.staffBase(clinicId,'/positions')}/${encodeURIComponent(positionId)}/reactivate`,{expectedVersion});}
  listPositionAssignments(clinicId:string,query:ClinicPositionAssignmentQuery={}):Observable<ClinicPositionAssignmentPage>{let params=new HttpParams();for(const [key,value] of Object.entries(query)){if(value!==undefined)params=params.set(key,String(value));}return this.http.get<ClinicPositionAssignmentPage>(this.staffBase(clinicId,'/position-assignments'),{params});}
  createPositionAssignment(clinicId:string,request:ClinicPositionAssignmentCreateRequest):Observable<ClinicPositionAssignment>{return this.http.post<ClinicPositionAssignment>(this.staffBase(clinicId,'/position-assignments'),request);}
  endPositionAssignment(clinicId:string,assignmentId:string,expectedVersion:number):Observable<ClinicPositionAssignment>{return this.http.post<ClinicPositionAssignment>(`${this.staffBase(clinicId,'/position-assignments')}/${encodeURIComponent(assignmentId)}/end`,{expectedVersion});}
  listResponsibilities(clinicId:string,query:ClinicResponsibilityQuery={}):Observable<ClinicResponsibilityPage>{let params=new HttpParams();for(const [key,value] of Object.entries(query)){if(value!==undefined)params=params.set(key,String(value));}return this.http.get<ClinicResponsibilityPage>(this.staffBase(clinicId,'/responsibilities'),{params});}
  getResponsibility(clinicId:string,id:string):Observable<ClinicResponsibility>{return this.http.get<ClinicResponsibility>(`${this.staffBase(clinicId,'/responsibilities')}/${encodeURIComponent(id)}`);}
  createResponsibility(clinicId:string,request:ClinicResponsibilityCreateRequest):Observable<ClinicResponsibility>{return this.http.post<ClinicResponsibility>(this.staffBase(clinicId,'/responsibilities'),request);}
  updateResponsibility(clinicId:string,id:string,request:ClinicResponsibilityUpdateRequest):Observable<ClinicResponsibility>{return this.http.put<ClinicResponsibility>(`${this.staffBase(clinicId,'/responsibilities')}/${encodeURIComponent(id)}`,request);}
  deactivateResponsibility(clinicId:string,id:string,expectedVersion:number):Observable<ClinicResponsibility>{return this.http.post<ClinicResponsibility>(`${this.staffBase(clinicId,'/responsibilities')}/${encodeURIComponent(id)}/deactivate`,{expectedVersion});}
  reactivateResponsibility(clinicId:string,id:string,expectedVersion:number):Observable<ClinicResponsibility>{return this.http.post<ClinicResponsibility>(`${this.staffBase(clinicId,'/responsibilities')}/${encodeURIComponent(id)}/reactivate`,{expectedVersion});}

  private staffBase(clinicId: string, suffix: string): string {
    return `${this.config.apiBaseUrl}/clinics/${encodeURIComponent(clinicId)}${suffix}`;
  }

  private caseBase(clinicId: string): string {
    return this.staffBase(clinicId, '/cases');
  }

  private taskBase(clinicId: string): string {
    return this.staffBase(clinicId, '/tasks');
  }

  private taskUrl(clinicId: string, taskId: string): string {
    return `${this.taskBase(clinicId)}/${encodeURIComponent(taskId)}`;
  }

  private listHandovers(
    clinicId: string,
    direction: 'incoming' | 'outgoing',
    page: number,
    pageSize: number,
  ): Observable<ClinicTaskHandoverPage> {
    return this.http.get<ClinicTaskHandoverPage>(
      `${this.staffBase(clinicId, '/task-handovers')}/${direction}`,
      { params: new HttpParams().set('page', String(page)).set('pageSize', String(pageSize)) },
    );
  }

  private handoverCommand(
    clinicId: string,
    handoverId: string,
    command: 'accept' | 'decline' | 'cancel',
  ): Observable<ClinicTaskHandover> {
    return this.http.post<ClinicTaskHandover>(
      `${this.staffBase(clinicId, '/task-handovers')}/${encodeURIComponent(handoverId)}/${command}`,
      {},
    );
  }

  private taskParams(query: ClinicTaskQuery): HttpParams {
    let params = new HttpParams();
    if (query.status !== undefined) params = params.set('status', query.status);
    if (query.priority !== undefined) params = params.set('priority', query.priority);
    if (query.taskType !== undefined) params = params.set('taskType', query.taskType);
    if (query.responsibilityType !== undefined) {
      params = params.set('responsibilityType', query.responsibilityType);
    }
    if (query.page !== undefined) params = params.set('page', String(query.page));
    if (query.pageSize !== undefined) params = params.set('pageSize', String(query.pageSize));
    return params;
  }

  private caseUrl(clinicId: string, caseId: string): string {
    return `${this.caseBase(clinicId)}/${encodeURIComponent(caseId)}`;
  }

  private staffMemberUrl(clinicId: string, membershipId: string): string {
    return `${this.staffBase(clinicId, '/staff')}/${encodeURIComponent(membershipId)}`;
  }
}
