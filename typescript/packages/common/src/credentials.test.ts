import { describe, expect, it } from 'vitest';
import { CredentialPrimitiveValue, Credentials, parseCredentials, stringifyCredentials } from './credentials';

describe('Credentials', () => {
	const testCredentials: Credentials = {
		token: 'abc123',
		claims: new Map<string, CredentialPrimitiveValue>([
			['id😄😄😄', 'user_123'],
			['email', 'jane.doe@example.com'],
			['username', 'jane_doe'],
		]),
		roles: ['admin', 'editor', 42, BigInt(7), true, false],
		signature: 'xyz789',
	};

	it('should stringify and parse correctly', () => {
		const jsonString = stringifyCredentials(testCredentials);
		const parsedCredentials = parseCredentials(jsonString);
		expect(parsedCredentials).toStrictEqual(testCredentials);
	});

	it('should read this', () => {
		const jsonString = '{"token":"abc123","claims":{"_map":true,"id\uD83D\uDE04\uD83D\uDE04\uD83D\uDE04":"user_123","email":"jane.doe@example.com","username":"jane_doe"},"roles":["admin","editor",42,"7||n",true,false],"signature":"xyz789"}'
		const parsedCredentials = parseCredentials(jsonString);
		expect(parsedCredentials).toStrictEqual(testCredentials);
	})
});
