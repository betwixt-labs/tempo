import { describe, it, expect } from 'vitest';
import { Base64 } from './base64';

describe('Base64', () => {
	it('should correctly encode data', () => {
		const testData = new Uint8Array([84, 101, 115, 116]); // ASCII for 'Test'
		const expectedResult = 'VGVzdA==';

		expect(Base64.encode(testData)).toBe(expectedResult);
	});

	it('should correctly decode data', () => {
		const testData = 'VGVzdA==';
		const expectedResult = new Uint8Array([84, 101, 115, 116]);

		expect(Base64.decode(testData)).toEqual(expectedResult);
	});

	it('should correctly handle data with padding', () => {
		const testData = new Uint8Array([84, 101, 115]); // ASCII for 'Tes'
		const expectedResult = 'VGVz';

		expect(Base64.encode(testData)).toBe(expectedResult);
	});

	it('should correctly handle data without padding', () => {
		const testData = 'VGVz';
		const expectedResult = new Uint8Array([84, 101, 115]);

		expect(Base64.decode(testData)).toEqual(expectedResult);
	});

	it('should handle round trip encoding and decoding', () => {
		const testData = new Uint8Array([84, 101, 115, 116, 97, 98, 99, 100]); // ASCII for 'Testabcd'

		expect(Base64.decode(Base64.encode(testData))).toEqual(testData);
	});
});

describe('Base64 Fuzzing', () => {
	it('should correctly handle random data', () => {
		// Run the test 100 times
		for (let i = 0; i < 100; i++) {
			// Generate a Uint8Array of random length (up to 256) with random values
			const randomLength = Math.floor(Math.random() * 256);
			const randomData = new Uint8Array(randomLength);
			for (let j = 0; j < randomLength; j++) {
				randomData[j] = Math.floor(Math.random() * 256);
			}
			// Encode and decode the random data and expect to get back the same data
			const roundTripData = Base64.decode(Base64.encode(randomData));
			expect(roundTripData).toEqual(randomData);
		}
	});
});
