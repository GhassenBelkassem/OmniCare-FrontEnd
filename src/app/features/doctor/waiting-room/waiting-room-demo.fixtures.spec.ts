import { describe, expect, it } from 'vitest';

import {
  DEMO_WAITING_ROOM_PATIENTS,
  compareQueueOrder,
  waitingMinutes,
} from './waiting-room-demo.fixtures';

describe('waiting-room demo fixtures', () => {
  it('computes waiting time only from actual arrival time', () => {
    const marie = DEMO_WAITING_ROOM_PATIENTS.find((patient) => patient.name === 'Marie Dupont');
    const lucas = DEMO_WAITING_ROOM_PATIENTS.find((patient) => patient.name === 'Lucas Petit');
    expect(marie && waitingMinutes(marie, '11:20')).toBe(25);
    expect(lucas && waitingMinutes(lucas, '11:20')).toBeNull();
  });

  it('keeps appointment no-show separate from physical queue status', () => {
    const noShow = DEMO_WAITING_ROOM_PATIENTS.find(
      ({ appointmentStatus }) => appointmentStatus === 'NO_SHOW',
    );
    expect(noShow?.queueStatus).toBe('EXPECTED');
  });

  it('orders scheduled patients before walk-ins without inventing priority', () => {
    const scheduled = DEMO_WAITING_ROOM_PATIENTS[0];
    const walkIn = { ...scheduled, id: 'walk-in', appointmentTime: null, walkIn: true };
    expect(compareQueueOrder(scheduled, walkIn)).toBeLessThan(0);
  });
});
