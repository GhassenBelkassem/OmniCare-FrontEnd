import {
  DEMO_PATIENT_DIRECTORY,
  demoPatientAge,
  findDemoPatient,
} from './patient-directory-demo.fixtures';

describe('static demo patient directory fixtures', () => {
  it('models the approved 8,462-record administrative directory', () => {
    expect(DEMO_PATIENT_DIRECTORY).toHaveLength(8_462);
    expect(DEMO_PATIENT_DIRECTORY.filter((patient) => patient.category === 'LINKED')).toHaveLength(
      3_124,
    );
    expect(DEMO_PATIENT_DIRECTORY.filter((patient) => patient.category === 'CABINET')).toHaveLength(
      4_892,
    );
    expect(DEMO_PATIENT_DIRECTORY.filter((patient) => patient.category === 'WALK_IN')).toHaveLength(
      446,
    );
  });

  it('resolves route identities without falling back to a different patient', () => {
    const amira = findDemoPatient('demo-practice-patient-amira');
    const ahmed = findDemoPatient('demo-practice-patient-ahmed');

    expect(amira?.firstName).toBe('Amira');
    expect(ahmed?.firstName).toBe('Ahmed');
    expect(amira?.id).not.toBe(ahmed?.id);
    expect(findDemoPatient('unknown-patient')).toBeNull();
    expect(amira ? demoPatientAge(amira) : null).toBe(41);
  });

  it('contains administrative fields only', () => {
    const serialized = JSON.stringify(DEMO_PATIENT_DIRECTORY.slice(0, 25));
    expect(serialized).not.toMatch(
      /diagnos|allerg|medication|prescription|bloodType|condition|clinicalAlert/i,
    );
  });
});
