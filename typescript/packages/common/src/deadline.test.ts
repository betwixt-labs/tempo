import { describe, expect, it } from 'vitest';
import { Deadline } from './deadline';
import { TempoError } from './error';
import { TempoStatusCode } from './status';

describe('Deadline', () => {
	it('should create a deadline instance that expires after a specified duration', async () => {
		const deadline = Deadline.after(1, 'seconds');
		const startTime = new Date().getTime();
		await new Promise((resolve) => setTimeout(resolve, 1000));
		const expired = deadline.isExpired();
		const endTime = new Date().getTime();
		const elapsedTime = endTime - startTime;
		expect(elapsedTime).toBeGreaterThanOrEqual(1000);
		expect(elapsedTime).toBeLessThanOrEqual(1100);
		expect(expired).toBe(true);
	});

	it('should execute a function within the deadline without throwing an error', async () => {
		const deadline = Deadline.after(2, 'seconds');
		const myFunction = async () => {
			return 'Function executed successfully';
		};
		const result = await deadline.executeWithinDeadline(myFunction);
		expect(result).toBe('Function executed successfully');
	});

	it('should throw an error if a function does not complete within the deadline', async () => {
		const deadline = Deadline.after(1, 'seconds');
		const myFunction = async () => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			return 'Function executed successfully';
		};

		try {
			await deadline.executeWithinDeadline(myFunction);
		} catch (error) {
			expect(error instanceof TempoError).toBe(true);
			if (error instanceof TempoError) {
				expect(error.status).toBe(TempoStatusCode.DEADLINE_EXCEEDED);
			}
		}
	});

	it('should abort the function execution using AbortController', async () => {
		const deadline = Deadline.after(1, 'seconds');
		const abortController = new AbortController();

		const myFunction = async () => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			return 'Function executed successfully';
		};

		setTimeout(() => {
			abortController.abort();
		}, 500);

		try {
			const result = await deadline.executeWithinDeadline(myFunction, abortController);
			// If the function execution is not aborted, this line will throw an error
			expect(result).toBeUndefined();
		} catch (error) {
			expect(error instanceof TempoError).toBe(true);
			if (error instanceof TempoError) {
				// Ensure the error message is related to the aborting of the function execution
				expect(error.status).toBe(TempoStatusCode.ABORTED);
			}
		}
	});

	it('should create a deadline with an infinite timeout', async () => {
		const deadline = Deadline.infinite();
		const result = await deadline.executeWithinDeadline(() => Promise.resolve(42));
		expect(result).toBe(42);
	});

	it('should be possible to abort execution with a signal', async () => {
		const deadline = Deadline.infinite();
		const abortController = new AbortController();
		setTimeout(() => {
			abortController.abort();
		}, 2000);
		try {
			await deadline.executeWithinDeadline(() => new Promise((resolve) => setTimeout(resolve, 10000)), abortController);
		} catch (error) {
			expect(error instanceof TempoError).toBe(true);
			if (error instanceof TempoError) {
				// Ensure the error message is related to the aborting of the function execution
				expect(error.status).toBe(TempoStatusCode.ABORTED);
			}
		}

		// await expect(promise).rejects.toThrow('Function execution aborted.');
	});
});
