import { describe, it, expect } from 'vitest';
import { TempoUtil } from './utils';
import { TempoError } from './error';

describe('getContentType', () => {
	it('should correctly parse application/tempo+json; charset=utf-8', () => {
		const { format, charSet } = TempoUtil.parseContentType('application/tempo+json; charset=utf-8');
		expect(format).toBe('json');
		expect(charSet).toBe('utf-8');
	});

	it('should correctly parse application/tempo+bebop', () => {
		const { format, charSet } = TempoUtil.parseContentType('application/tempo+bebop');
		expect(format).toBe('bebop');
		expect(charSet).toBeUndefined();
	});

	it('should throw error if no content type header', () => {
		expect(() => TempoUtil.parseContentType(null as unknown as string)).toThrow(TempoError);
	});

	it('should throw error if content type does not include application/tempo', () => {
		expect(() => TempoUtil.parseContentType('application/json; charset=utf-8')).toThrow(TempoError);
	});

	it('should throw error if no format on content type', () => {
		expect(() => TempoUtil.parseContentType('application/tempo')).toThrow(TempoError);
	});

	it('should throw error for unknown format', () => {
		expect(() => TempoUtil.parseContentType('application/tempo+unknownFormat')).toThrow(TempoError);
	});
});
