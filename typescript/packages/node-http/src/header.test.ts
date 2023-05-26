import { describe, it } from 'vitest';
import { FetchHeadersAdapter } from './header';

describe('FetchHeadersAdapter', () => {
	it('should retrieve header value using get()', () => {
		const adapter = new FetchHeadersAdapter({ 'Content-Type': 'application/json' });
		const value = adapter.get('Content-Type');
		return value === 'application/json';
	});

	it('should check if header exists using has()', () => {
		const adapter = new FetchHeadersAdapter({ 'Content-Type': 'application/json' });
		const exists = adapter.has('Content-Type');
		return exists;
	});

	it('should iterate over each header using forEach()', () => {
		const adapter = new FetchHeadersAdapter({ 'Content-Type': 'application/json', Authorization: 'Bearer token' });
		let count = 0;
		adapter.forEach((_value, _name) => {
			count++;
		});
		return count === 2;
	});

	it('should iterate over header names using keys()', () => {
		const adapter = new FetchHeadersAdapter({ 'Content-Type': 'application/json', Authorization: 'Bearer token' });
		const keys = Array.from(adapter.keys());
		return keys.length === 2 && keys.includes('content-type') && keys.includes('authorization');
	});

	it('should iterate over header values using values()', () => {
		const adapter = new FetchHeadersAdapter({ 'Content-Type': 'application/json', Authorization: 'Bearer token' });
		const values = Array.from(adapter.values());
		return values.length === 2 && values.includes('application/json') && values.includes('Bearer token');
	});

	it('should iterate over header entries using entries()', () => {
		const adapter = new FetchHeadersAdapter({ 'Content-Type': 'application/json', Authorization: 'Bearer token' });
		const entries = Array.from(adapter.entries());
		return (
			entries.length === 2 &&
			entries.some(([name, value]) => name === 'content-type' && value === 'application/json') &&
			entries.some(([name, value]) => name === 'authorization' && value === 'Bearer token')
		);
	});
});
