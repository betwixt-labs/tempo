/**
 * Represents a time interval.
 */

export class TimeSpan {
	/**
	 * The number of ticks in the time interval represented by the current TimeSpan instance.
	 */
	public readonly ticks: number;
	/**
	 * Represents the number of ticks in 1 microsecond.
	 */
	public static readonly ticksPerMicrosecond = 10;
	/**
	 * The number of ticks in one millisecond.
	 */
	public static readonly ticksPerMillisecond = 10000;
	/**
	 * The number of ticks in one second.
	 */
	public static readonly ticksPerSecond = TimeSpan.ticksPerMillisecond * 1000;

	/**
	 * The number of ticks in one minute.
	 */
	public static readonly ticksPerMinute = TimeSpan.ticksPerSecond * 60;
	/**
	 * The number of ticks in one hour.
	 */
	public static readonly ticksPerHour = TimeSpan.ticksPerMinute * 60;
	/**
	 * The number of ticks in one day.
	 */
	public static readonly ticksPerDay = TimeSpan.ticksPerHour * 24;

	/**
	 * Initializes a new instance of the TimeSpan class with a specified number of ticks.
	 * @param ticks The number of ticks.
	 */
	constructor(ticks: number);
	/**
	 * Initializes a new instance of the TimeSpan class with a specified number of days, hours, minutes, seconds, and milliseconds.
	 * @param days The number of days.
	 * @param hours The number of hours.
	 * @param minutes The number of minutes.
	 * @param seconds The number of seconds.
	 * @param milliseconds The number of milliseconds.
	 * @param microseconds The number of microseconds.
	 */
	constructor(
		days: number,
		hours: number,
		minutes: number,
		seconds: number,
		milliseconds?: number,
		microseconds?: number,
	);
	/**
	 * Initializes a new instance of the TimeSpan class with a specified number of days, hours, minutes, seconds, and milliseconds.
	 * @param daysOrTicks The number of days or ticks.
	 * @param hours The number of hours.
	 * @param minutes The number of minutes.
	 * @param seconds The number of seconds.
	 * @param milliseconds The number of milliseconds.
	 * @param microseconds The number of microseconds.
	 */
	constructor(
		daysOrTicks: number,
		hours?: number,
		minutes?: number,
		seconds?: number,
		milliseconds?: number,
		microseconds?: number,
	) {
		if (hours === undefined && minutes === undefined && seconds === undefined) {
			this.ticks = daysOrTicks;
		} else {
			const days = daysOrTicks;
			const totalTicks =
				((((days * 24 + (hours || 0)) * 60 + (minutes || 0)) * 60 + (seconds || 0)) * 1000 + (milliseconds || 0)) *
					10000 +
				(microseconds || 0) * 10;
			this.ticks = totalTicks;
		}
	}

	/**
	 *  Returns a new TimeSpan object from the specified number of days.
	 * @param value - The number of days.
	 * @returns - A new TimeSpan object from the specified number of days.
	 */
	public static fromDays(value: number): TimeSpan {
		return new TimeSpan(value * TimeSpan.ticksPerDay);
	}

	/**
	 *  Returns a new TimeSpan object from the specified number of hours.
	 * @param value - The number of hours.
	 * @returns - A new TimeSpan object from the specified number of hours.
	 */
	public static fromHours(value: number): TimeSpan {
		return new TimeSpan(value * TimeSpan.ticksPerHour);
	}

	public static fromMinutes(value: number): TimeSpan {
		return new TimeSpan(value * TimeSpan.ticksPerMinute);
	}

	public static fromSeconds(value: number): TimeSpan {
		return new TimeSpan(value * TimeSpan.ticksPerSecond);
	}

	public static fromMilliseconds(value: number): TimeSpan {
		return new TimeSpan(value * TimeSpan.ticksPerMillisecond);
	}

	public static fromMicroseconds(value: number): TimeSpan {
		return new TimeSpan(value * TimeSpan.ticksPerMicrosecond);
	}

	public static fromTicks(ticks: number): TimeSpan {
		return new TimeSpan(ticks);
	}

	get days(): number {
		return Math.floor(this.ticks / TimeSpan.ticksPerDay);
	}

	get hours(): number {
		return Math.floor((this.ticks / TimeSpan.ticksPerHour) % 24);
	}

	get milliseconds() {
		return Math.round((this.ticks / TimeSpan.ticksPerMillisecond) % 1000);
	}
	get minutes() {
		return Math.round((this.ticks / TimeSpan.ticksPerMinute) % 60);
	}
	get seconds() {
		return Math.round((this.ticks / TimeSpan.ticksPerSecond) % 60);
	}

	public get totalDays(): number {
		return this.ticks / TimeSpan.ticksPerDay;
	}

	public get totalHours(): number {
		return this.ticks / TimeSpan.ticksPerHour;
	}

	public get totalMinutes(): number {
		return this.ticks / TimeSpan.ticksPerMinute;
	}

	public get totalSeconds(): number {
		return this.ticks / TimeSpan.ticksPerSecond;
	}

	public get totalMilliseconds(): number {
		return this.ticks / TimeSpan.ticksPerMillisecond;
	}

	public add(other: TimeSpan): TimeSpan {
		return new TimeSpan(this.ticks + other.ticks);
	}

	public static compare(ts1: TimeSpan, ts2: TimeSpan): number {
		if (ts1.ticks < ts2.ticks) return -1;
		if (ts1.ticks > ts2.ticks) return 1;
		return 0;
	}

	public compareTo(other: TimeSpan): number {
		return TimeSpan.compare(this, other);
	}

	public divide(divisor: number | TimeSpan): TimeSpan {
		divisor = divisor instanceof TimeSpan ? divisor.ticks : divisor;
		return new TimeSpan(Math.floor(this.ticks / divisor));
	}

	public divideByTimeSpan(timeSpan: TimeSpan): number {
		return this.ticks / timeSpan.ticks;
	}

	public equals(other: TimeSpan): boolean {
		return this.ticks === other.ticks;
	}

	public static equals(ts1: TimeSpan, ts2: TimeSpan): boolean {
		return ts1.ticks === ts2.ticks;
	}

	public multiply(factor: number): TimeSpan {
		return new TimeSpan(Math.floor(this.ticks * factor));
	}

	public negate(): TimeSpan {
		return new TimeSpan(-this.ticks);
	}

	static get zero(): TimeSpan {
		return new TimeSpan(0);
	}

	public static add(ts1: TimeSpan, ts2: TimeSpan): TimeSpan {
		return ts1.add(ts2);
	}

	public static divide(ts: TimeSpan, divisor: number): TimeSpan {
		return ts.divide(divisor);
	}

	public static greaterThan(ts1: TimeSpan, ts2: TimeSpan): boolean {
		return ts1.ticks > ts2.ticks;
	}

	public static greaterThanOrEqual(ts1: TimeSpan, ts2: TimeSpan): boolean {
		return ts1.ticks >= ts2.ticks;
	}

	public static lessThan(ts1: TimeSpan, ts2: TimeSpan): boolean {
		return ts1.ticks < ts2.ticks;
	}

	public static lessThanOrEqual(ts1: TimeSpan, ts2: TimeSpan): boolean {
		return ts1.ticks <= ts2.ticks;
	}

	public static multiply(factor: number, ts: TimeSpan): TimeSpan {
		return ts.multiply(factor);
	}

	public static subtract(ts1: TimeSpan, ts2: TimeSpan): TimeSpan {
		return new TimeSpan(ts1.ticks - ts2.ticks);
	}

	public static unaryNegation(ts: TimeSpan): TimeSpan {
		return ts.negate();
	}

	public static unaryPlus(ts: TimeSpan): TimeSpan {
		return ts;
	}

	public static fromDateDifference(start: Date, end: Date): TimeSpan {
		const timeSpanTicks = (end.getTime() - start.getTime()) * TimeSpan.ticksPerMillisecond;
		return new TimeSpan(timeSpanTicks);
	}
}
