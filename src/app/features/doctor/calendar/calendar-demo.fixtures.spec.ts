import { DEMO_CALENDAR_APPOINTMENTS, DEMO_CALENDAR_DAY_STATES } from './calendar-demo.fixtures';

describe('calendar demo fixtures', () => {
  it('keeps appointment identifiers unique and inside the useful working-day range', () => {
    const ids = DEMO_CALENDAR_APPOINTMENTS.map((appointment) => appointment.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const appointment of DEMO_CALENDAR_APPOINTMENTS) {
      const start = appointment.start.slice(11, 16);
      const end = appointment.end.slice(11, 16);
      expect(start >= '08:00').toBe(true);
      expect(end <= '17:00').toBe(true);
    }
  });

  it('distinguishes routine rest, day off and configured exception states', () => {
    expect(new Set(DEMO_CALENDAR_DAY_STATES.map((state) => state.kind))).toEqual(
      new Set(['weekly-rest', 'day-off', 'exception']),
    );
    expect(DEMO_CALENDAR_DAY_STATES.find((state) => state.kind === 'exception')).toMatchObject({
      title: 'Indisponible',
      description: 'Exception configurée',
    });
  });
});
