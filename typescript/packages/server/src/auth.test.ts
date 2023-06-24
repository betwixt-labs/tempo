import { beforeEach, describe, expect, it } from 'vitest';
import { AuthContext } from './auth';
import { TempoError } from '@tempojs/common';

describe('AuthContext', () => {
	let authContext: AuthContext;
	let key: string;
	let propertyName: string;
	let propertyValue: unknown;

	beforeEach(() => {
		authContext = new AuthContext();
		key = 'key1';
		propertyName = 'prop1';
		propertyValue = 'value1';
		authContext.addProperty(key, propertyName, propertyValue);
	});

	it('should add a new property', () => {
		const prop = authContext.findPropertyByName(key, propertyName);
		expect(prop).toBeDefined();
		expect(prop?.name).toEqual(propertyName);
		expect(prop?.getValue()).toEqual(propertyValue);
	});

	it('should return peer identity if authenticated', () => {
		authContext.peerIdentityKey = key;
		const peerIdentity = authContext.peerIdentity;
		expect(peerIdentity).toBeDefined();
		expect(peerIdentity?.[0]?.name).toEqual(propertyName);
		expect(peerIdentity?.[0]?.getValue()).toEqual(propertyValue);
	});

	it('should throw TempoError when setting undefined key as peerIdentityKey', () => {
		expect(() => {
			authContext.peerIdentityKey = undefined;
		}).toThrow(TempoError);
	});

	it('should throw TempoError when setting a non-existent key as peerIdentityKey', () => {
		expect(() => {
			authContext.peerIdentityKey = 'nonExistentKey';
		}).toThrow(TempoError);
	});

	it('should return undefined for non-authenticated peer', () => {
		const nonAuthenticatedContext = new AuthContext();
		const peerIdentity = nonAuthenticatedContext.peerIdentity;
		expect(peerIdentity).toBeUndefined();
	});

	it('should return undefined for non-existing property', () => {
		const prop = authContext.findPropertyByName(key, 'nonExistingProperty');
		expect(prop).toBeUndefined();
	});

	it('should return undefined for properties of non-existing key', () => {
		const properties = authContext.getProperties('nonExistingKey');
		expect(properties).toBeUndefined();
	});
});

describe('AuthContext - Edge Cases', () => {
	let authContext: AuthContext;

	beforeEach(() => {
		authContext = new AuthContext();
	});

	it('should handle adding a property with null or undefined key', () => {
		expect(() => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			//@ts-ignore
			authContext.addProperty(null, 'propertyName', 'value');
		}).toThrow(TempoError);
		expect(() => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			//@ts-ignore
			authContext.addProperty(undefined, 'propertyName', 'value');
		}).toThrow(TempoError);
	});

	it('should handle adding a property with null or undefined name', () => {
		expect(() => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			//@ts-ignore
			authContext.addProperty('key', null, 'value');
		}).toThrow(TempoError);
		expect(() => {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			//@ts-ignore
			authContext.addProperty('key', undefined, 'value');
		}).toThrow(TempoError);
	});

	it('should handle adding a property with undefined value', () => {
		expect(() => authContext.addProperty('key', 'propertyName', undefined)).toThrow(TempoError);
	});

	it('should handle multiple properties with the same key and name', () => {
		const value1 = 'value1';
		const value2 = 'value2';
		authContext.addProperty('key', 'propertyName', value1);
		authContext.addProperty('key', 'propertyName', value2);
		const properties = authContext.findPropertiesByName('key', 'propertyName');
		expect(properties).toBeDefined();
		expect(properties?.length).toEqual(2);
		expect(properties?.[0]?.getValue()).toEqual(value1);
		expect(properties?.[1]?.getValue()).toEqual(value2);
	});

	it('should throw error when trying to set peer identity with non-existing key', () => {
		expect(() => {
			authContext.peerIdentityKey = 'nonExistentKey';
		}).toThrow(TempoError);
	});

	it('should handle setting peer identity with a key that exists but has no properties', () => {
		const emptyKey = 'emptyKey';
		authContext.addProperty(emptyKey, 'propertyName', 'value');
		authContext.getProperties(emptyKey)?.pop();
		expect(() => {
			authContext.peerIdentityKey = emptyKey;
		}).not.toThrow();
		expect(authContext.peerIdentity).length(0);
	});
});
