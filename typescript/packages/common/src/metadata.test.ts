import { describe, expect, it } from 'vitest';
import { Metadata } from './metadata';

describe('Metadata', () => {
	it('sets and gets string values', () => {
		const metadata = new Metadata();
		metadata.set('key1', 'value1');
		metadata.set('kEy2', 'value2');

		const valuesForKey1 = metadata.get('key1');
		const valuesForKey2 = metadata.get('Key2');

		expect(valuesForKey1).toBeTruthy();
		expect(valuesForKey2).toBeTruthy();
		expect(valuesForKey1![0]).toBe('value1');
		expect(valuesForKey2![0]).toBe('value2');
	});

	it('sets and gets binary values', () => {
		const metadata = new Metadata();
		const binaryValue1 = new TextEncoder().encode('value1');
		const binaryValue2 = new TextEncoder().encode('value2');

		metadata.set('key1-bin', binaryValue1);
		metadata.set('Key2-bin', binaryValue2);

		const valuesForKey1 = metadata.get('key1-bin');
		const valuesForKey2 = metadata.get('Key2-bin');

		expect(valuesForKey1).toBeTruthy();
		expect(valuesForKey2).toBeTruthy();
		expect(new TextEncoder().encode(valuesForKey1![0]).toString()).toBe(binaryValue1.toString());
		expect(new TextEncoder().encode(valuesForKey2![0]).toString()).toBe(binaryValue2.toString());
	});

	it('appends values', () => {
		const metadata = new Metadata();
		metadata.set('key1', 'value1');
		metadata.append('key1', 'value2');
		metadata.append('Key1', 'value3');

		const valuesForKey1 = metadata.get('key1');

		expect(valuesForKey1).toBeTruthy();
		expect(valuesForKey1).toEqual(['value1', 'value2', 'value3']);
	});

	it('removes values', () => {
		const metadata = new Metadata();
		metadata.set('key1', 'value1');
		metadata.set('key2', 'value2');

		metadata.remove('key1');

		const valuesForKey1 = metadata.get('key1');
		const valuesForKey2 = metadata.get('key2');

		expect(valuesForKey1).toBeUndefined();
		expect(valuesForKey2).toBeTruthy();
		expect(valuesForKey2![0]).toBe('value2');
	});

	it('handles invalid keys', () => {
		const metadata = new Metadata();
		const emptyKey = '';
		const invalidKey = 'key1\0';

		expect(() => metadata.set(emptyKey, 'value1')).toThrow();
		expect(() => metadata.append(emptyKey, 'value2')).toThrow();
		expect(metadata.get(emptyKey)).toBeUndefined();
		expect(() => metadata.remove(emptyKey)).not.toThrow();

		expect(() => metadata.set(invalidKey, 'value1')).toThrow();
		expect(() => metadata.append(invalidKey, 'value2')).toThrow();
		expect(metadata.get(invalidKey)).toBeUndefined();
		expect(() => metadata.remove(invalidKey)).not.toThrow();
	});

	it('expects setting the invalid key to fail', () => {
		const metadata = new Metadata();
		const edgeCaseKey = 'key1;|';
		const edgeCaseValue = 'value1;|';

		expect(() => metadata.set(edgeCaseKey, edgeCaseValue)).toThrow();
	});

	it('fuzzing test', () => {
		const metadata = new Metadata();
		const key1 = 'key1';
		const key2 = 'key2';

		for (let i = 0; i < 1000; i++) {
			metadata.set(key1, `value${i}`);
			metadata.set(key2, `value${i}`);
		}

		const valuesForKey1 = metadata.get(key1);
		const valuesForKey2 = metadata.get(key2);

		expect(valuesForKey1).toBeTruthy();
		expect(valuesForKey2).toBeTruthy();
		expect(valuesForKey1![0]).toBe('value999');
		expect(valuesForKey2![0]).toBe('value999');
	});

	it('base64 binary roundtrip test', () => {
		const metadata = new Metadata();
		const key = 'key-bin';
		const value = new Uint8Array([118, 97, 108, 117, 101, 50]); // equivalent to 'value2'

		metadata.set(key, value);

		const httpHeader = metadata.toHttpHeader();
		const metadataFromHeader = Metadata.fromHttpHeader(httpHeader);

		const valuesForKey = metadataFromHeader.get(key);

		expect(valuesForKey).toBeTruthy();
		expect(valuesForKey![0]).toBeDefined();
		expect(valuesForKey![0]).toEqual(new TextDecoder().decode(value));
	});

	it('toHttpHeader and fromHttpHeader test with binary data', () => {
		const metadata = new Metadata();
		const key1 = 'key1';
		const key2 = 'key2-bin';
		const value1 = 'value1';
		const value2 = new Uint8Array([118, 97, 108, 117, 101, 50]); // equivalent to 'value2'

		metadata.set(key1, value1);
		metadata.set(key2, value2);

		const httpHeader = metadata.toHttpHeader();
		const metadataFromHeader = Metadata.fromHttpHeader(httpHeader);

		const valuesForKey1 = metadataFromHeader.get(key1);
		const valuesForKey2 = metadataFromHeader.get(key2);

		expect(valuesForKey1).toBeTruthy();
		expect(valuesForKey1![0]).toBe(value1);

		expect(valuesForKey2).toBeTruthy();
		expect(valuesForKey2![0]).toEqual(new TextDecoder().decode(value2));
	});

	it('fuzzing test for toHttpHeader', () => {
		const metadata = new Metadata();
		const numKeys = 10;
		const numValuesPerKey = 10;
		const keyLength = 20;
		const valueLength = 20;

		const randomString = (length: number): string => {
			const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			let result = '';
			for (let i = 0; i < length; i++) {
				result += characters.charAt(Math.floor(Math.random() * characters.length));
			}
			return result;
		};

		for (let i = 0; i < numKeys; i++) {
			const key = randomString(keyLength);
			const numValues = Math.floor(Math.random() * numValuesPerKey) + 1; // Random number of values for each key
			for (let j = 0; j < numValues; j++) {
				const value = randomString(valueLength);
				metadata.set(key, value);
			}
		}

		const httpHeader = metadata.toHttpHeader();
		const metadataFromHeader = Metadata.fromHttpHeader(httpHeader);

		for (const key of metadata.keys()) {
			const values = metadataFromHeader.get(key);

			expect(values).toBeTruthy();
			expect(values!.length).toBeGreaterThanOrEqual(1);
		}

		const totalNumValues = metadata.keys().reduce((count, key) => {
			const values = metadata.get(key);
			return count + (values ? values.length : 0);
		}, 0);

		expect(totalNumValues).toBeGreaterThanOrEqual(numValuesPerKey);
	});

	it('fuzzing test for fromHttpHeader', () => {
		const numHeaders = 1000;
		const keyLength = 20;
		const valueLength = 20;

		const randomString = (length: number): string => {
			const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			let result = '';
			for (let i = 0; i < length; i++) {
				result += characters.charAt(Math.floor(Math.random() * characters.length));
			}
			return result;
		};

		const headers: string[] = [];
		for (let i = 0; i < numHeaders; i++) {
			const numValues = Math.floor(Math.random() * 10) + 1; // Random number of values for each key
			const key = randomString(keyLength);
			const values = [];
			for (let j = 0; j < numValues; j++) {
				const value = randomString(valueLength);
				values.push(value);
			}
			const header = `${key}: ${values.join(',')}`;
			headers.push(header);
		}

		const headerString = headers.join('|');
		const metadata = Metadata.fromHttpHeader(headerString);

		for (const key of metadata.keys()) {
			const values = metadata.get(key);
			expect(values).toBeTruthy();
			expect(Array.isArray(values)).toBe(true);
		}
	});
});
