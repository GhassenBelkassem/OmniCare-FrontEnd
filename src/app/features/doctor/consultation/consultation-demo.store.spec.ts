import { ConsultationDemoStore } from './consultation-demo.store';

describe('ConsultationDemoStore', () => {
  let store: ConsultationDemoStore;

  beforeEach(() => {
    store = new ConsultationDemoStore();
  });

  it('keeps explicit clinical save state and does not autosave edits', async () => {
    store.updateClinical('notes', 'Observation locale');

    expect(store.clinicalSaveState()).toBe('dirty');
    expect(store.hasUnsavedChanges()).toBe(true);

    store.saveClinical('11:05:03');
    expect(store.clinicalSaveState()).toBe('saving');
    await Promise.resolve();

    expect(store.clinicalSaveState()).toBe('saved');
    expect(store.lastSavedAt()).toBe('11:05:03');
  });

  it('keeps prescription and orders as separately saved domains', () => {
    store.addMedication();
    store.addOrder('LAB', 'NFS');

    expect(store.prescriptionSaveState()).toBe('dirty');
    expect(store.ordersSaveState()).toBe('dirty');
    expect(store.canFinish()).toBe(false);

    store.savePrescription();
    expect(store.prescriptionSaveState()).toBe('saved');
    expect(store.ordersSaveState()).toBe('dirty');

    store.saveOrders();
    expect(store.canFinish()).toBe(true);
  });

  it('preserves local content through conflict and error scenarios', () => {
    store.updateClinical('assessment', 'Texte local');
    store.setClinicalScenario('conflict');
    store.saveClinical();

    expect(store.clinicalSaveState()).toBe('conflict');
    expect(store.clinicalDraft().assessment).toBe('Texte local');

    store.resolveClinicalScenario();
    expect(store.clinicalSaveState()).toBe('dirty');
  });

  it('only completes the local simulation when every domain is saved', () => {
    store.updateClinical('notes', 'À enregistrer');
    store.finishLocally();
    expect(store.finished()).toBe(false);

    store.saveClinical();
    return Promise.resolve().then(() => {
      store.finishLocally();
      expect(store.finished()).toBe(true);
    });
  });
});
