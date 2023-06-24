import { BebopJson } from 'bebop';

/**
 * A type representing credentials as a record of key-value pairs.
 */
export type Credential = Record<string, unknown>;

const charsToEncode = /[\u007f-\uffff]/g;

/**
 * Parses a string representation of credentials into a Credentials object.
 * @param credentials - The string representation of credentials.
 * @returns A Credentials object, or undefined if the input is not valid.
 */
export const parseCredential = (credentials: string): Credential | undefined =>
	JSON.parse(
		credentials.replace(/\\u([\d\w]{4})/g, (_, hex) => {
			return String.fromCharCode(parseInt(hex, 16));
		}),
		BebopJson.reviver,
	);

/**
 * Stringifies a Credentials object into a string representation.
 * @param credentials - The Credentials object to stringify.
 * @returns A string representation of the credentials.
 */
export const stringifyCredential = (credentials: Credential): string =>
	JSON.stringify(credentials, BebopJson.replacer).replace(
		charsToEncode,
		(c) => '\\u' + `000${c.charCodeAt(0).toString(16)}`.slice(-4),
	);
