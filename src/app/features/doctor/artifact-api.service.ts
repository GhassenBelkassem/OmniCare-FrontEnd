import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import type { ArtifactListResponse, ArtifactResponse, ArtifactType, CertificateDefinition } from './artifact.models';

@Injectable({ providedIn: 'root' })
export class ArtifactApiService {
  private readonly http=inject(HttpClient); private readonly config=inject(RUNTIME_CONFIG);
  list(consultationId:string):Observable<ArtifactListResponse>{return this.http.get<ArtifactListResponse>(this.base(consultationId));}
  createCertificate(consultationId:string,type:'MEDICAL_CERTIFICATE'|'SICK_LEAVE_CERTIFICATE',definition:CertificateDefinition,key:string):Observable<ArtifactResponse>{return this.http.post<ArtifactResponse>(this.base(consultationId),{artifactType:type,sourceResourceId:null,sourceResourceVersion:null,definition},{headers:this.key(key)});}
  createSource(consultationId:string,type:ArtifactType,sourceResourceId:string,sourceResourceVersion:number,key:string):Observable<ArtifactResponse>{return this.http.post<ArtifactResponse>(this.base(consultationId),{artifactType:type,sourceResourceId,sourceResourceVersion,definition:{}},{headers:this.key(key)});}
  update(consultationId:string,artifactId:string,expectedArtifactVersion:number,definition:CertificateDefinition,key:string):Observable<ArtifactResponse>{return this.http.put<ArtifactResponse>(`${this.base(consultationId)}/${encodeURIComponent(artifactId)}`,{expectedArtifactVersion,definition},{headers:this.key(key)});}
  finalize(consultationId:string,value:ArtifactResponse,key:string):Observable<ArtifactResponse>{return this.http.post<ArtifactResponse>(`${this.base(consultationId)}/${encodeURIComponent(value.artifactId)}/finalize`,{expectedArtifactVersion:value.artifactVersion,confirmation:true},{headers:this.key(key)});}
  download(consultationId:string,artifactId:string):Observable<Blob>{return this.http.get(`${this.base(consultationId)}/${encodeURIComponent(artifactId)}/download`,{responseType:'blob'});}
  /** Discards a DRAFT certificate (204). A signed document is refused (409). */
  discard(consultationId:string,artifactId:string,expectedArtifactVersion:number,key:string):Observable<void>{return this.http.delete<void>(`${this.base(consultationId)}/${encodeURIComponent(artifactId)}`,{params:{expectedArtifactVersion},headers:this.key(key)});}
  private base(id:string):string{return `${this.config.apiBaseUrl}/doctor/consultations/${encodeURIComponent(id)}/artifacts`;}
  private key(value:string):HttpHeaders{return new HttpHeaders({'Idempotency-Key':value});}
}
