import { ConsoleLogger } from '@tempojs/common';
import { ObjectValidator } from './objects';
import { describe, expect, it } from 'vitest';

describe('ObjectValidator', () => {
	const validator = new ObjectValidator(new ConsoleLogger(''));

	it('should return true for valid objects', () => {
		const validObject = {
			name: 'John Doe',
			email: 'john.doe@example.com',
		};
		expect(validator.sanitize(validObject)).toBe(true);
	});

	it('should return false for objects with forbidden characters', () => {
		const invalidObject = {
			name: 'John Doe',
			email: 'john.doe@example.com${alert(1)}',
		};
		expect(validator.sanitize(invalidObject)).toBe(false);
	});

	it('should replace HTML tags with escaped strings', () => {
		const emptyStringObject = {
			name: 'John Doe',
			email: '<>',
		};
		validator.sanitize(emptyStringObject);

		expect(emptyStringObject.name).toBe('John Doe');
		expect(emptyStringObject.email).toBe('&lt;&gt;');
	});

	it('should return false for objects with nested forbidden characters', () => {
		const nestedInvalidObject = {
			name: 'John Doe',
			details: {
				email: 'john.doe@example.com${alert(1)}',
			},
		};
		expect(validator.sanitize(nestedInvalidObject)).toBe(false);
	});

	it('should trim leading and trailing whitespaces from strings', () => {
		const stringWithWhitespaces = {
			name: ' John Doe ',
			email: ' john.doe@example.com ',
		};
		validator.sanitize(stringWithWhitespaces);

		expect(stringWithWhitespaces.name).toBe('John Doe');
		expect(stringWithWhitespaces.email).toBe('john.doe@example.com');
	});

	// Fuzz test
	const fuzzIterations = 1000;
	it(`should not throw exceptions during fuzz testing (with ${fuzzIterations} iterations)`, () => {
		const generateRandomString = (length: number): string => {
			const characters =
				'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[{]}\\|;:\'",<.>/?`~';
			let result = '';
			for (let i = 0; i < length; i++) {
				result += characters.charAt(Math.floor(Math.random() * characters.length));
			}
			return result;
		};

		for (let i = 0; i < fuzzIterations; i++) {
			const fuzzObject = {
				key1: generateRandomString(10),
				key2: generateRandomString(10),
				key3: generateRandomString(10),
			};
			const result = validator.sanitize(fuzzObject);
			expect(typeof result).toBe('boolean');
		}
	});

	it('should sanitize nested objects properly', () => {
		const nestedObject = {
			name: 'John Doe',
			details: {
				email: 'john.doe@example.com<script>alert("XSS")</script>',
				website: 'https://example.com>',
			},
			friends: [
				{
					name: 'Jane Doe',
					email: 'jane.doe@example.com"onerror="alert(\'XSS\')',
				},
			],
		};

		const sanitized = validator.sanitize(nestedObject);

		expect(sanitized).toBe(true);
		expect(nestedObject.details.email).toBe('john.doe@example.com&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
		expect(nestedObject.details.website).toBe('https://example.com&gt;');
		expect(nestedObject.friends[0]!.email).toBe('jane.doe@example.com&quot;onerror=&quot;alert(&apos;XSS&apos;)');
	});
});
