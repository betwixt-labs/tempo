export type CredentialPrimitiveValue = string | number | boolean | bigint;
export type NestedCredentialObject = {
	[K in string]: CredentialValue;
};
export type CredentialValue =
	| CredentialPrimitiveValue
	| Map<string, CredentialPrimitiveValue>
	| Array<CredentialPrimitiveValue>
	| NestedCredentialObject;
/**
 * A type representing credentials as a record of key-value pairs.
 */
export type Credentials = Record<string, CredentialValue>;

/**
 * A custom replacer function for JSON.stringify that supports BigInt, Map,
 * including BigInt values inside Map and Array.
 * @param _key - The key of the property being stringified.
 * @param value - The value of the property being stringified.
 * @returns The modified value for the property, or the original value if not a BigInt or Map.
 */
const replacer = (_key: string, value: any): any => {
	if (typeof value === 'bigint') {
		return value.toString() + '||n';
	}
	if (value instanceof Map) {
		const obj = Object.fromEntries([...value.entries()].map(([k, v]) => [k, replacer(k, v)]));
		obj._map = true;
		return obj;
	}
	if (Array.isArray(value)) {
		return value.map((v, i) => replacer(i.toString(), v));
	}
	return value;
};

/**
 * A custom reviver function for JSON.parse that supports BigInt, Map,
 * including BigInt values inside Map and Array.
 * @param _key - The key of the property being parsed.
 * @param value - The value of the property being parsed.
 * @returns The modified value for the property, or the original value if not a BigInt or Map.
 */
const reviver = (_key: string, value: any): any => {
	if (typeof value === 'string' && value.endsWith('||n')) {
		return BigInt(value.slice(0, -3));
	}
	if (typeof value === 'object' && value._map) {
		delete value._map;
		return new Map(Object.entries(value).map(([k, v]) => [k, reviver(k, v)]));
	}
	if (Array.isArray(value)) {
		return value.map((v, i) => reviver(i.toString(), v));
	}
	return value;
};

const charsToEncode = /[\u007f-\uffff]/g;

/**
 * Parses a string representation of credentials into a Credentials object.
 * @param credentials - The string representation of credentials.
 * @returns A Credentials object, or undefined if the input is not valid.
 */
export const parseCredentials = (credentials: string): Credentials | undefined => {
	const decodedCredentials = credentials.replace(/\\u([\d\w]{4})/g, (_, hex) => {
		return String.fromCharCode(parseInt(hex, 16));
	});

	return JSON.parse(decodedCredentials, reviver);
};

/**
 * Stringifies a Credentials object into a string representation.
 * @param credentials - The Credentials object to stringify.
 * @returns A string representation of the credentials.
 */
export const stringifyCredentials = (credentials: Credentials): string => {
	return JSON.stringify(credentials, replacer).replace(charsToEncode, function (c) {
		return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
	});
};
