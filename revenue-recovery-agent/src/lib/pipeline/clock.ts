/**
 * Simulated Clock
 * Accelerates time so days/weeks of dunning can be observed in minutes.
 */

export class SimulatedClock {
  private startRealTime: number;
  private startSimTime: Date;
  private accelerationFactor: number; // e.g. 3600 = 1 real second = 1 sim hour

  constructor(startSimTime: Date = new Date(), accelerationFactor: number = 3600) {
    this.startRealTime = Date.now();
    this.startSimTime = new Date(startSimTime);
    this.accelerationFactor = accelerationFactor;
  }

  /** Current simulated time */
  now(): Date {
    const realElapsedMs = Date.now() - this.startRealTime;
    const simElapsedMs = realElapsedMs * this.accelerationFactor;
    return new Date(this.startSimTime.getTime() + simElapsedMs);
  }

  /** Simulated hour of day (0-23) */
  currentHour(): number {
    return this.now().getHours();
  }

  /** How many sim-hours have elapsed since a given date */
  simHoursSince(date: Date): number {
    return (this.now().getTime() - date.getTime()) / (1000 * 60 * 60);
  }

  /** How many sim-days have elapsed since a given date */
  simDaysSince(date: Date): number {
    return this.simHoursSince(date) / 24;
  }

  /** Advance simulated time by N hours (returns new Date) */
  advance(hours: number): Date {
    return new Date(this.now().getTime() + hours * 60 * 60 * 1000);
  }

  /** Create a clock positioned N sim-hours in the future from now */
  atOffset(simHoursFromNow: number): Date {
    return new Date(this.now().getTime() + simHoursFromNow * 60 * 60 * 1000);
  }

  getAccelerationFactor(): number {
    return this.accelerationFactor;
  }
}

/** Create a batch-run clock that starts at current time and accelerates aggressively for demo */
export function createBatchClock(): SimulatedClock {
  const factor = parseInt(process.env.CLOCK_ACCELERATION_FACTOR ?? '3600', 10);
  return new SimulatedClock(new Date(), factor);
}

/**
 * For batch processing: instead of real-time advancement,
 * we precompute sim-times by spreading cases across a simulated timeline.
 * This lets us process a full 30-day dunning cycle in seconds.
 */
export function createTimelinePositions(totalCases: number, simDaysSpan: number = 30): Date[] {
  const now = new Date();
  const positions: Date[] = [];
  for (let i = 0; i < totalCases; i++) {
    const dayOffset = (i / totalCases) * simDaysSpan;
    const position = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    // Set hours to business hours (10am default)
    position.setHours(10, 0, 0, 0);
    positions.push(position);
  }
  return positions;
}
