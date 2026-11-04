import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OcButton } from '../../../shared/ui';
import { ArtifactStore } from '../artifact.store';
import type { ArtifactResponse, CertificateDefinition } from '../artifact.models';
import { PrescriptionStore } from '../prescription.store';
import { ClinicalOrderStore } from '../clinical-order.store';
import type { ClinicalOrder } from '../clinical-order.models';

@Component({selector:'app-official-artifacts',imports:[FormsModule,OcButton],templateUrl:'./official-artifacts.html',styleUrl:'./official-artifacts.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class OfficialArtifacts {
 readonly consultationId=input.required<string>(); readonly store=inject(ArtifactStore); readonly prescriptions=inject(PrescriptionStore); readonly orders=inject(ClinicalOrderStore);
 constructor(){const destroy=inject(DestroyRef);effect(()=>this.store.attach(this.consultationId()));destroy.onDestroy(()=>this.store.clear());}
 label(value:ArtifactResponse):string{return ({PRESCRIPTION:'Ordonnance PDF',SICK_LEAVE_CERTIFICATE:'Congé maladie',MEDICAL_CERTIFICATE:'Certificat médical',LAB_ORDER:'Ordre laboratoire',IMAGING_ORDER:'Ordre imagerie'} as const)[value.artifactType];}
 update(field:keyof CertificateDefinition,value:string|number):void{this.store.change({...this.store.draft(),[field]:value});}
 canCreatePrescription():boolean{const value=this.prescriptions.authoritative();return !this.store.loading()&&value?.finalized===true&&value.prescriptionId!==null&&!this.hasSource(value.prescriptionId);}
 hasSource(id:string):boolean{return this.store.artifacts().some(value=>value.sourceResourceId===id);}
 createPrescription():void{const value=this.prescriptions.authoritative();if(!this.store.loading()&&value?.finalized===true&&value.status==='ACTIVE'&&value.prescriptionId!==null&&!this.hasSource(value.prescriptionId)&&!this.store.saving())void this.store.createSource('PRESCRIPTION',value.prescriptionId,value.prescriptionVersion);}
  isSickEditor(editor:string):boolean{return editor.startsWith('new:SICK')||this.store.artifacts().some(value=>value.artifactId===editor&&value.artifactType==='SICK_LEAVE_CERTIFICATE');}
  sourceOrders():readonly ClinicalOrder[]{return this.store.loading()?[]:this.orders.orders().filter(value=>value.status==='FINALIZED'&&value.category!=='REFERRAL'&&!this.hasSource(value.clinicalOrderId));}
  unreadySourceOrders():readonly ClinicalOrder[]{return this.orders.orders().filter(value=>value.status!=='FINALIZED'&&value.category!=='REFERRAL');}
  createOrder(value:ClinicalOrder):void{if(this.store.loading()||value.status!=='FINALIZED'||value.category==='REFERRAL'||this.hasSource(value.clinicalOrderId)||this.store.saving())return;void this.store.createSource(value.category==='LAB'?'LAB_ORDER':'IMAGING_ORDER',value.clinicalOrderId,value.clinicalOrderVersion);}
 finalize(value:ArtifactResponse):void{if(globalThis.window?.confirm('Finaliser et signer cet artefact ? Il deviendra immuable.')??false)void this.store.finalize(value);}
}
