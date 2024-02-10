import { Clock } from './time';
import { describe, it, expect } from 'vitest';

describe('Timer Module', () => {
	it('startTimer should return a function that calculates elapsed time', async () => {
		const endTimer = Clock.startTimer();
		await new Promise((resolve) => setTimeout(resolve, 100));
		const elapsed = endTimer();
		// it should have been at least 100ms, but we allow some leeway
		expect(elapsed).toBeGreaterThanOrEqual(90);
		// it should not have taken more than 150ms
		expect(elapsed).toBeLessThan(150);
	});
});
