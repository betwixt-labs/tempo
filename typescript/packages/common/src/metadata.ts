import { TempoError } from './error';
import { Base64 } from './base64';
import { TempoStatusCode } from './status';
import { TempoUtil } from './utils';

/**
 * The Metadata class supports setting, appending, and getting metadata entries, as well as
 * converting the metadata into an HTTP header string and creating a Metadata
 * instance from an HTTP header string. This class also handles both string
 * and binary data, encoding and decoding binary data as needed.
 */
export class Metadata {
	// The internal data structure used to store metadata key-value pairs.
	private data: Map<string, string[]>;
	private isFrozen: boolean;
	/**
	 * Constructs a new Metadata instance.
	 */
	constructor() {
		this.data = new Map();
		this.isFrozen = false;
	}

	public size(): number {
		return this.data.size;
	}

	/**
	 * Checks if the given key is valid according to the following rules:
	 * - Keys are automatically converted to lowercase, so "key1" and "kEy1" will be the same key.
	 * - Metadata keys are always strings.
	 * - To store binary data value in metadata, simply add a "-bin" suffix to the key.
	 * @param key The metadata key.
	 * @returns True if the key is valid, false otherwise.
	 */
	private static isValidKey(key: string): boolean {
		if (!key) return false;
		const bytes = TempoUtil.utf8GetBytes(key); // Tempo validates strings on the byte level, not Unicode.
		for (const ch of bytes) {
			const validLowercaseLetter = ch >= 97 && ch <= 122;
			const validUppercaseLetter = ch >= 65 && ch <= 90;
			const validDigit = ch >= 48 && ch <= 57;
			const validOther = ch === 46 || ch === 45 || ch === 95;
			if (!validLowercaseLetter && !validUppercaseLetter && !validDigit && !validOther) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Validates that a given string is a valid Tempo ASCII-Value.
	 * A valid Tempo ASCII-Value must be printable ASCII (including/plus spaces), ranging from 0x20 to 0x7E inclusive.
	 *
	 * @param {string} textValue - The string to validate.
	 *
	 * @returns {boolean} - Returns true if the string is a valid Tempo ASCII-Value, and false otherwise.
	 */
	private static isValidMetadataTextValue(textValue: string): boolean {
		// Must be a valid Tempo "ASCII-Value" as defined here:
		// This means printable ASCII (including/plus spaces); 0x20 to 0x7E inclusive.
		const bytes = TempoUtil.utf8GetBytes(textValue); // Tempo validates strings on the byte level, not Unicode.
		for (const ch of bytes) {
			if (ch < 0x20 || ch > 0x7e) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Checks if the given key corresponds to binary data.
	 * @param key The metadata key.
	 * @returns True if the key has a "-bin" suffix, false otherwise.
	 */
	private static isBinaryKey(key: string): boolean {
		return key.endsWith('-bin');
	}

	/**
	 * Encodes the given string to base64.
	 * @param value The input string.
	 * @returns The base64-encoded string.
	 */
	private static base64Encode(value: Uint8Array): string {
		return Base64.encode(value);
	}

	/**
	 * Decodes the given base64-encoded string.
	 * @param value The base64-encoded input string.
	 * @returns The decoded string.
	 */
	private static base64Decode(value: string): Uint8Array {
		return Base64.decode(value);
	}

	/**
	 * Sets a metadata entry with the given key and value.
	 * If the key already exists, its value will be replaced.
	 * @param key The metadata key. It will be converted to lowercase.
	 * @param value The metadata value, can be a string or ArrayBuffer.
	 */
	set(key: string, value: string | Uint8Array): void {
		if (this.isFrozen)
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to set metadata on a frozen collection.');
		if (!Metadata.isValidKey(key)) throw new TempoError(TempoStatusCode.INTERNAL, `Invalid metadata key: '${key}'`);
		key = key.toLowerCase();

		const isBinaryValue = value instanceof Uint8Array;
		const isBinaryKey = Metadata.isBinaryKey(key);
		if (!isBinaryKey && isBinaryValue)
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to set binary value without a valid binary key');
		if (isBinaryKey && !isBinaryValue)
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to set text value with a binary key');

		if (isBinaryKey && isBinaryValue) value = Metadata.base64Encode(value as Uint8Array);

		if (!Metadata.isValidMetadataTextValue(value as string)) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'invalid metadata value: not ASCII');
		}
		this.data.set(key, [value as string]);
	}

	/**
	 * Appends a value to an existing metadata entry with the given key.
	 * If the key does not exist, a new entry will be created.
	 * @param key The metadata key. It will be converted to lowercase.
	 * @param value The metadata value, can be a string or ArrayBuffer.
	 */
	append(key: string, value: string | Uint8Array): void {
		if (this.isFrozen)
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to append metadata on a frozen collection.');
		if (!Metadata.isValidKey(key)) throw new TempoError(TempoStatusCode.INTERNAL, `Invalid metadata key: '${key}'`);

		key = key.toLowerCase();
		const isBinaryValue = value instanceof Uint8Array;
		const isBinaryKey = Metadata.isBinaryKey(key);

		if (!isBinaryKey && isBinaryValue)
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to set binary value without a valid binary key');
		if (isBinaryKey && !isBinaryValue)
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to set text value with a binary key');

		if (isBinaryKey && isBinaryValue) value = Metadata.base64Encode(value as Uint8Array);

		if (!Metadata.isValidMetadataTextValue(value as string)) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'invalid metadata value: not ASCII');
		}

		const existingValues = this.data.get(key) || [];

		existingValues.push(value as string);
		this.data.set(key, existingValues);
	}

	/**
	 * Retrieves the values for a metadata entry with the given key.
	 * @param key The metadata key. It will be converted to lowercase.
	 * @returns An array of metadata values or undefined if the key does not exist.
	 * @deprecated Use getBinaryValues or getTextValues instead.
	 */
	get(key: string): string[] | Uint8Array[] | undefined {
		key = key.toLowerCase();
		const values = this.data.get(key);
		if (!values) {
			return undefined;
		}
		if (Metadata.isBinaryKey(key)) {
			return values.map((value) => Metadata.base64Decode(value));
		} else {
			return values;
		}
	}

	/**
	 * Retrieves the binary values for a metadata entry with the given key.
	 * @param key The metadata key. Case-insensitive.
	 * @returns An array of binary metadata values or undefined if the key does not exist.
	 */
	getBinaryValues(key: string): Uint8Array[] | undefined {
		if (!Metadata.isBinaryKey(key))
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to get binary values with a text key');
		key = key.toLowerCase();
		return this.data.get(key)?.map((value) => Metadata.base64Decode(value));
	}
	/**
	 * Retrieves the text values for a metadata entry with the given key.
	 * @param key The metadata key. Case-insensitive.
	 * @returns An array of text metadata values or undefined if the key does not exist.
	 */
	getTextValues(key: string): string[] | undefined {
		if (Metadata.isBinaryKey(key))
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to get text values with a binary key');
		key = key.toLowerCase();
		return this.data.get(key);
	}

	/**
	 * Removes a metadata entry with the given key.
	 * @param key The metadata key. It will be converted to lowercase.
	 */
	remove(key: string): void {
		if (this.isFrozen) {
			throw new Error('Attempted to remove metadata from a frozen collection.');
		}
		key = key.toLowerCase();
		this.data.delete(key);
	}

	public keys(): string[] {
		return [...this.data.keys()];
	}

	/**
	 * Escapes any pipe symbols in the given string by prefixing them with a backslash.
	 * @param value The input string.
	 * @returns The escaped string.
	 */
	private static escape(value: string): string {
		return value.replace(/\|/g, '\\|').trim();
	}

	/**
	 * Unescapes any escaped pipe symbols in the given string by removing the backslashes.
	 * @param value The input string.
	 * @returns The unescaped string.
	 */
	private static unescape(value: string): string {
		return value.replace(/\\\|/g, '|');
	}

	/**
	 * Converts the metadata to a single HTTP header string.
	 * The resulting header string can be appended to an HTTP response
	 * as 'Metadata: {metadata}'.
	 * @returns The HTTP header string.
	 */
	toHttpHeader(): string {
		const headers: string[] = [];

		for (const [key, values] of this.data) {
			const escapedKey = Metadata.escape(key);
			const escapedValues = values.map(Metadata.escape);
			headers.push(`${escapedKey}:${escapedValues.join(',')}`);
		}

		return headers.join('|');
	}

	freeze(): void {
		this.isFrozen = true;
	}

	/**
	 * Concatenates (joins) another Metadata instance into the current one.
	 * If a key already exists, the values from the other instance will be appended.
	 * If a key does not exist, the values from the other instance will be set.
	 * @param otherMetadata The other Metadata instance to merge.
	 */
	concat(otherMetadata: Metadata): void {
		if (this.isFrozen)
			throw new TempoError(TempoStatusCode.INTERNAL, 'Attempted to concat metadata into a frozen collection.');
		for (const key of otherMetadata.keys()) {
			const otherValues = otherMetadata.get(key);
			if (otherValues) {
				for (const value of otherValues) {
					this.append(key, value);
				}
			}
		}
	}

	/**
	 * Concatenates two or more Metadata instances into a new one.
	 * If a key already exists, the values from the other instances will be appended.
	 * If a key does not exist, the values from the other instances will be set.
	 * @param metadataInstances The Metadata instances to concatenate.
	 * @returns A new Metadata instance containing the merged data.
	 */
	static concat(...metadataInstances: Metadata[]): Metadata {
		const resultMetadata = new Metadata();
		for (const metadataInstance of metadataInstances) {
			resultMetadata.concat(metadataInstance);
		}
		return resultMetadata;
	}

	/**
	 * Creates a new Metadata instance from an HTTP header string.
	 * @param header The input header string.
	 * @returns A new Metadata instance.
	 */
	static fromHttpHeader(header: string): Metadata {
		const metadata = new Metadata();
		const entries = header.split('|');
		for (const entry of entries) {
			const [key, valueStr] = entry.split(':');
			if (key === undefined || valueStr === undefined) {
				throw new TempoError(TempoStatusCode.INTERNAL, 'Invalid header format');
			}
			const values = valueStr.split(',');

			const unescapedKey = Metadata.unescape(key);
			for (const value of values) {
				const unescapedValue = Metadata.unescape(value);
				if (Metadata.isBinaryKey(unescapedKey)) {
					metadata.append(unescapedKey, Metadata.base64Decode(unescapedValue));
				} else {
					metadata.append(unescapedKey, unescapedValue);
				}
			}
		}
		return metadata;
	}
}
