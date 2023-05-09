import { describe, it, assert } from 'vitest';
import { TimeSpan } from './timespan';

describe('TimeSpan', () => {
	it('should create a TimeSpan from ticks', () => {
		const ticks = 1234567890;
		const ts = new TimeSpan(ticks);
		assert.strictEqual(ts.totalMilliseconds, ticks / TimeSpan.ticksPerMillisecond);
	});
	it('should create a TimeSpan from days, hours, minutes, seconds, milliseconds, and microseconds', () => {
		const days = 1;
		const hours = 2;
		const minutes = 30;
		const seconds = 45;
		const milliseconds = 500;
		const microseconds = 300;
		const ts = new TimeSpan(days, hours, minutes, seconds, milliseconds, microseconds);
		const expectedTicks =
			(((((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000 + milliseconds) * 1000 + microseconds) * 10;
		assert.strictEqual(ts.ticks, expectedTicks);
	});
	it('should add two TimeSpans', () => {
		const ts1 = new TimeSpan(1000 * TimeSpan.ticksPerMillisecond);
		const ts2 = new TimeSpan(2000 * TimeSpan.ticksPerMillisecond);
		const added = ts1.add(ts2);
		assert.strictEqual(added.totalMilliseconds, 3000);
	});
	it('should divide a TimeSpan by a number', () => {
		const ts = new TimeSpan(1000 * TimeSpan.ticksPerMillisecond);
		const divisor = 2;
		const divided = ts.divide(divisor);
		assert.strictEqual(divided.totalMilliseconds, 500);
	});
	it('should compare two TimeSpans', () => {
		const ts1 = new TimeSpan(1000 * TimeSpan.ticksPerMillisecond);
		const ts2 = new TimeSpan(2000 * TimeSpan.ticksPerMillisecond);
		assert.isTrue(TimeSpan.lessThan(ts1, ts2));
		assert.isTrue(TimeSpan.greaterThan(ts2, ts1));
		assert.isTrue(TimeSpan.lessThanOrEqual(ts1, ts2));
		assert.isTrue(TimeSpan.greaterThanOrEqual(ts2, ts1));
		assert.isFalse(TimeSpan.equals(ts1, ts2));
	});

	it('should multiply a TimeSpan by a number', () => {
		const ts = new TimeSpan(1000 * TimeSpan.ticksPerMillisecond);
		const factor = 2;
		const multiplied = ts.multiply(factor);
		assert.strictEqual(multiplied.totalMilliseconds, 2000);
	});

	it('should subtract two TimeSpans', () => {
		const ts1 = new TimeSpan(2000 * TimeSpan.ticksPerMillisecond);
		const ts2 = new TimeSpan(1000 * TimeSpan.ticksPerMillisecond);
		const subtracted = TimeSpan.subtract(ts1, ts2);
		assert.strictEqual(subtracted.totalMilliseconds, 1000);
	});

	it('should negate a TimeSpan', () => {
		const ts = new TimeSpan(1000 * TimeSpan.ticksPerMillisecond);
		const negated = TimeSpan.unaryNegation(ts);
		assert.strictEqual(negated.totalMilliseconds, -1000);
	});

	it('should return the same TimeSpan with unaryPlus', () => {
		const ts = new TimeSpan(1000 * TimeSpan.ticksPerMillisecond);
		const result = TimeSpan.unaryPlus(ts);
		assert.strictEqual(result.totalMilliseconds, ts.totalMilliseconds);
	});
});
