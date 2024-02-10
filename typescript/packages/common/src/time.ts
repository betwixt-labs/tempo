import { ExecutionEnvironment } from './utils';

// Determine the most precise timing function available
const hasPerformanceNow =
	typeof performance !== 'undefined' && 'now' in performance && typeof performance.now === 'function';
const useProcessHrTime = !hasPerformanceNow && ExecutionEnvironment.isNode;
const useDateNow = !hasPerformanceNow && !useProcessHrTime;
export type EndTimer = () => number;
// Universal timing method
// The now and startTimer functions remain the same
const internal_now = hasPerformanceNow
	? performance.now.bind(performance)
	: useProcessHrTime
	? process.hrtime.bind(process)
	: Date.now;

export const Clock = {
	/**
	 * Returns a function that calculates the elapsed time since the startTimer function was called.
	 * The timing function used is determined by the most precise timing function available.
	 * @returns {EndTimer} A function that returns the elapsed time in milliseconds.
	 */
	startTimer: (): EndTimer => {
		const startTime = internal_now() as unknown;
		return () => {
			if (useDateNow || hasPerformanceNow) {
				return (internal_now() as number) - (startTime as number);
			} else if (useProcessHrTime) {
				const hrTime = process.hrtime(startTime as [number, number]);
				return hrTime[0] * 1000 + hrTime[1] / 1e6; // convert to milliseconds
			}
			return -1;
		};
	},
	/**
	 * Returns the current Unix timestamp with high resolution.
	 * The timing function used is performance.now() and performance.timeOrigin.
	 * @returns {number} The current Unix timestamp in seconds.
	 */
	highResUnixTimestamp: (): number => {
		const timeOrigin = performance.timeOrigin;
		const now = performance.now();
		return (timeOrigin + now) / 1000; // in seconds
	},
};
