import { describe, expect, it } from 'vitest';
import { Credential, parseCredential, stringifyCredential } from './credential';

describe('Credential', () => {
	const testCredential: Credential = {
		token: 'abc123',
		claims: new Map<string, string>([
			['id😄😄😄', 'user_123'],
			['email', 'jane.doe@example.com'],
			['username', 'jane_doe'],
		]),
		roles: ['admin', 'editor', 42, BigInt(7), true, false],
		signature: 'xyz789',
	};

	it('should stringify and parse correctly', () => {
		const jsonString = stringifyCredential(testCredential);
		const parsedCredential: typeof testCredential | undefined = parseCredential(jsonString);
		expect(parsedCredential).toBeDefined();
		expect(parsedCredential!['token']).toStrictEqual(testCredential['token']);
		expect(parsedCredential!['claims']).toStrictEqual(testCredential['claims']);
		expect(parsedCredential!['roles']).toStrictEqual(testCredential['roles']);
	});
});
