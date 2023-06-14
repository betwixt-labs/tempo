import { TempoError } from './error';
import { TempoStatusCode } from './status';

/**
 * An interface for a cancelable function.
 */
export interface CancelableFunction {
	cancel(): void;
}

/**
 * A mapping of time units to their respective factors in milliseconds.
 */
const timeUnitFactors: Record<string, number> = {
	milliseconds: 1,
	seconds: 1000,
	minutes: 60 * 1000,
	hours: 60 * 60 * 1000,
};
/**
 * An array of tuples representing units and their corresponding factors.
 */
const units: Array<[string, number]> = [
	['m', 1],
	['S', 1000],
	['M', 60 * 1000],
	['H', 60 * 60 * 1000],
];

/**
 * A class to manage deadlines, which can be either dates or numbers.
 */
export class Deadline {
	/**
	 * The maximum timeout time in milliseconds.
	 */
	private static readonly MAX_TIMEOUT_TIME = 2147483647;
	/**
	 * The internal deadline value, which can be a Date or a number.
	 */
	private deadlineValue: Date;

	/**
	 * Constructs a new Deadline instance.
	 * @param deadline - The deadline value, which can be a Date or a number.
	 */
	constructor(deadline: Date) {
		// Convert the date to UTC, if not already
		const utcDate = new Date(
			Date.UTC(
				deadline.getUTCFullYear(),
				deadline.getUTCMonth(),
				deadline.getUTCDate(),
				deadline.getUTCHours(),
				deadline.getUTCMinutes(),
				deadline.getUTCSeconds(),
				deadline.getUTCMilliseconds(),
			),
		);
		this.deadlineValue = utcDate;
	}

	/**
	 * Returns the minimum deadline from a list of deadlines.
	 * @param deadlines - An array of Deadline instances.
	 * @returns A new Deadline instance with the minimum deadline value.
	 */
	public min(...deadlines: Deadline[]): Deadline {
		let minValue = this.deadlineValue.getTime();
		for (const deadline of deadlines) {
			const deadlineMsecs = deadline.deadlineValue.getTime();
			if (deadlineMsecs < minValue) {
				minValue = deadlineMsecs;
			}
		}
		return new Deadline(new Date(minValue));
	}

	/**
	 * Returns a string representation of the deadline timeout.
	 * @returns The timeout string representation.
	 * @throws Error if the deadline is too far in the future.
	 */
	public getTimeoutString(): string {
		const now = new Date().getTime();
		const deadline = this.deadlineValue.getTime();
		const timeoutMs = Math.max(deadline - now, 0);
		for (const [unit, factor] of units) {
			const amount = timeoutMs / factor;
			if (amount < 1e8) {
				return String(Math.ceil(amount)) + unit;
			}
		}
		throw new TempoError(TempoStatusCode.INTERNAL, 'Deadline is too far in the future');
	}

	/**
	 * Gets the relative timeout to be passed to setTimeout.
	 * @returns The relative timeout.
	 */
	public getRelativeTimeout(): number {
		const deadlineMs = this.deadlineValue.getTime();
		const now = new Date().getTime();
		const timeout = deadlineMs - now;
		if (timeout < 0) {
			return 0;
		} else if (timeout > Deadline.MAX_TIMEOUT_TIME) {
			return Infinity;
		} else {
			return timeout;
		}
	}

	/**
	 * Converts the deadline to an ISO string representation.
	 * @returns The deadline in ISO string format.
	 */
	public toString(): string {
		return this.deadlineValue.toISOString();
	}

	/**
	 * Creates a new Deadline instance from an ISO string representation.
	 * @param isoString - The ISO string representation of the deadline.
	 * @returns A new Deadline instance with the specified deadline value.
	 * @throws Error if the provided ISO string is not in UTC format.
	 */
	public static fromISOString(isoString: string): Deadline {
		if (!isoString.endsWith('Z')) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'Provided ISO string is not in UTC format');
		}
		const deadlineDate = new Date(isoString);
		return new Deadline(deadlineDate);
	}

	/**
	 * Returns the Unix timestamp (in milliseconds) of the deadline.
	 * @returns The Unix timestamp of the deadline.
	 */
	public toUnixTimestamp(): number {
		return this.deadlineValue.getTime();
	}

	/**
	 * Creates a new Deadline instance from a Unix timestamp (in milliseconds).
	 * @param unixTimestamp - The Unix timestamp (in milliseconds) of the deadline.
	 * @returns A new Deadline instance with the specified deadline value.
	 */
	public static fromUnixTimestamp(unixTimestamp: number): Deadline {
		const deadlineDate = new Date(unixTimestamp);
		return new Deadline(deadlineDate);
	}

	/**
	 * Checks if this deadline is before another deadline.
	 * @param other - Another Deadline instance.
	 * @returns True if this deadline is before the other deadline, false otherwise.
	 */
	public isBefore(other: Deadline): boolean {
		const thisDeadlineMs = this.deadlineValue.getTime();
		const otherDeadlineMs = other.deadlineValue.getTime();
		return thisDeadlineMs < otherDeadlineMs;
	}

	/**
	 * Checks if this deadline has expired.
	 * @returns True if the deadline has expired, false otherwise.
	 */
	public isExpired(): boolean {
		const now = new Date().getTime();
		const deadlineMs = this.deadlineValue.getTime();
		return now >= deadlineMs;
	}

	/**
	 * Creates a new Deadline instance that expires after a specified duration and time unit.
	 * @param duration - The duration of the offset.
	 * @param unit - The time unit for the offset (milliseconds, seconds, minutes, or hours).
	 * @returns A new Deadline instance that expires after the specified duration.
	 */
	public static after(duration: number, unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours'): Deadline {
		const factor = timeUnitFactors[unit];
		if (factor === undefined) {
			throw new TempoError(TempoStatusCode.INTERNAL, `Invalid time unit: ${unit}`);
		}
		const durationMs = duration * factor;
		const expirationTime = new Date().getTime() + durationMs;
		return new Deadline(new Date(expirationTime));
	}

	/**
	 * Creates a new Deadline instance that represents an effectively infinite deadline.
	 * @returns A new Deadline instance with an infinite deadline value.
	 */
	public static infinite(): Deadline {
		return Deadline.after(Deadline.MAX_TIMEOUT_TIME, 'milliseconds');
	}

	/**
	 * Executes a function within the deadline and optionally allows canceling the function using an AbortController.
	 * If the function does not complete execution within the deadline, an error is thrown.
	 * @param fn - A function that returns a Promise with a result.
	 * @param abortController - An optional AbortController instance to cancel the function execution.
	 * @returns The result of the function if it completes within the deadline.
	 * @throws Error if the function execution is aborted or does not complete within the deadline.
	 */
	public async executeWithinDeadline<T>(func: () => Promise<T>, abortController?: AbortController): Promise<T> {
		const deadlinePromise = new Promise<T>((_, reject) => {
			const timeout = this.getRelativeTimeout();
			const timer = setTimeout(() => {
				reject(new TempoError(TempoStatusCode.DEADLINE_EXCEEDED, 'RPC deadline exceeded.'));
			}, timeout);

			if (abortController) {
				abortController.signal.addEventListener('abort', () => {
					clearTimeout(timer);
					reject(new TempoError(TempoStatusCode.ABORTED, 'RPC call aborted by client'));
				});
			}
		});
		return Promise.race([func(), deadlinePromise]);
	}

	/**
	 * Executes a function when the deadline has expired.
	 * @param fn - A function to execute when the deadline has expired.
	 * @returns An object with a `cancel` method to cancel the execution of the function when it's no longer needed.
	 */
	public runOnExpiration(fn: () => void): CancelableFunction {
		const now = new Date().getTime();
		const deadline = this.deadlineValue.getTime();
		const timeout = Math.max(deadline - now, 0);
		const timeoutId = setTimeout(fn, timeout);
		const cancelFn = () => {
			clearTimeout(timeoutId);
		};
		return {
			cancel: cancelFn,
		};
	}

	/**
	 * Gets the total number of milliseconds remaining until the deadline.
	 * @returns The total number of milliseconds remaining until the deadline.
	 */
	public timeRemaining(): number {
		const now = new Date().getTime();
		const deadline = this.deadlineValue.getTime();
		return Math.max(deadline - now, 0);
	}
}
