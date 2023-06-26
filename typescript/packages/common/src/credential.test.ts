import { describe, expect, it } from 'vitest';
import { Credential, parseCredential, stringifyCredential } from './credential';
import { Guid } from 'bebop';

describe('Credential', () => {
	const id = Guid.newGuid();
	const testCredential: Credential = {
		token: 'abc123',
		claims: new Map<string, string>([
			['id😄😄😄', 'user_123'],
			['email', 'jane.doe@example.com'],
			['username', 'jane_doe'],
		]),
		roles: ['admin', 'editor', 42, BigInt(7), true, false, id],
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
