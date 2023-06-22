import { TempoError } from './error';
import { TempoStatusCode } from './status';

export type BebopContentType = 'bebop' | 'json';

// Instantiate a new 'TextEncoder' and export it.
const textEncoder = new TextEncoder();

// Instantiate a new 'TextDecoder' and export it.
const textDecoder = new TextDecoder();

// to silence the compiler
declare const Bun: { version: { deno?: string } } | undefined;
declare const Deno: { version: { deno?: string } } | undefined;

/**
 * An object containing constants to determine the current JavaScript runtime environment.
 * These constants help identify if the code is running in a browser, Node.js, a web worker, Deno, or jsdom.
 */
export const ExecutionEnvironment = {
	/**
	 * True if the current environment is a browser, otherwise false.
	 */
	isBrowser: typeof window !== 'undefined' && typeof window.document !== 'undefined',

	/**
	 * True if the current environment is Node.js, otherwise false.
	 */
	isNode: typeof process !== 'undefined' && process.versions != null && process.versions.node != null,

	/**
	 * True if the current environment is a Web Worker, otherwise false.
	 */
	isWebWorker: typeof self === 'object' && self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope',

	/**
	 * True if the current environment is Deno, otherwise false.
	 */
	isDeno:
		typeof Deno !== 'undefined' && typeof Deno.version !== 'undefined' && typeof Deno.version.deno !== 'undefined',

	/**
	 * True if the current environment is jsdom, otherwise false.
	 */
	isJsDom:
		(typeof window !== 'undefined' && window.name === 'nodejs') ||
		(typeof navigator !== 'undefined' &&
			(navigator.userAgent.includes('Node.js') || navigator.userAgent.includes('jsdom'))),
	/**
	 * True if the current environment is Bun, otherwise false.
	 */
	isBun: typeof Bun !== 'undefined' && typeof Bun.version !== 'undefined',
};

/**
 * Utility object that provides access to common utility functions.
 */
export const TempoUtil = {
	/**
	 * Parses a string into an int. Throws an error if the string is not a valid int.
	 * @param value - the string to parse
	 * @returns the parsed int
	 */
	tryParseInt: (value: string): number => {
		const num = parseFloat(value);
		if (isNaN(num) || !isFinite(num) || num % 1 !== 0) {
			throw new TempoError(TempoStatusCode.INTERNAL, `Invalid int: ${value}`);
		}
		return num;
	},

	/**
	 * Encodes a string into a Uint8Array using UTF-8 encoding.
	 * @param value - the string to encode
	 * @returns the encoded string
	 * @example
	 * ```typescript
	 * const encoded = TempoUtil.utf8GetBytes('Hello World!');
	 * ```
	 */
	utf8GetBytes: textEncoder.encode.bind(textEncoder),

	/**
	 * Decodes a Uint8Array into a string using UTF-8 encoding.
	 * @param value - the Uint8Array to decode
	 * @returns the decoded string
	 * @example
	 * ```typescript
	 * const decoded = TempoUtil.utf8GetString(new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]));
	 * ```
	 */
	utf8GetString: textDecoder.decode.bind(textDecoder),

	/**
	 * Builds a user agent string based on the given parameters.
	 *
	 * @param language - The language used in the tempo implementation.
	 * @param version - The version of the tempo implementation.
	 * @param variant - Optional variant of the tempo implementation.
	 * @param additionalProperties - Optional additional properties to include in the user agent string.
	 * @returns A formatted user agent string.
	 * @example
	 * ```typescript
	 * const userAgent = TempoUtil.buildUserAgent('typescript', '1.0.0', 'deno', { deno: '1.0.0' });
	 * console.log(userAgent); // tempo-typescript-deno/1.0.0 (deno/1.0.0)
	 * ```
	 */
	buildUserAgent: (
		language: string,
		version: string,
		variant?: string,
		additionalProperties?: Record<string, string | number>,
	) => {
		let agent = `tempo-${language}`;
		if (variant) {
			agent += `-${variant}`;
		}
		agent += `/${version}`;
		if (additionalProperties) {
			agent += ` (${Object.entries(additionalProperties)
				.map(([key, value]) => `${key}/${value}`)
				.join('; ')})`;
		}
		return agent;
	},
	/**
	 * Determines the name of the current JavaScript runtime environment.
	 * @returns The name of the current JavaScript runtime environment.
	 */
	getEnvironmentName: () => {
		if (ExecutionEnvironment.isBrowser) {
			return 'browser';
		} else if (ExecutionEnvironment.isWebWorker) {
			return 'webworker';
		} else if (ExecutionEnvironment.isNode) {
			return 'node';
		} else if (ExecutionEnvironment.isBun) {
			return 'bun';
		} else if (ExecutionEnvironment.isJsDom) {
			return 'jsdom';
		}
		return 'unknown';
	},
	/**
	 * Determines if the given object is an AsyncGeneratorFunction.
	 *
	 * @template T - The type of values yielded by the AsyncGenerator.
	 * @param obj - The object to be checked for being an AsyncGeneratorFunction.
	 * @returns A boolean value that indicates whether the given object is an AsyncGeneratorFunction or not.
	 *
	 * @example
	 * ```
	 * const asyncGenerator = async function*() { yield 1; };
	 * const isAsyncGen = isAsyncGeneratorFunction<number>(asyncGenerator);
	 * console.log(isAsyncGen); // true
	 * ```
	 */
	isAsyncGeneratorFunction: <T>(obj: unknown): obj is AsyncGenerator<T, void, undefined> => {
		return (
			obj !== undefined &&
			typeof obj === 'function' &&
			obj.constructor &&
			obj.constructor.name === 'AsyncGeneratorFunction'
		);
	},
	/**
	 * Parses the content type header and returns the content type and character set.
	 *
	 * @param header - The content type header to parse.
	 * @returns An object containing the content type and character set.
	 * @throws TempoError if the content type header is invalid or unknown.
	 *
	 * @example
	 * ```
	 * const header = 'application/tempo+json; charset=utf-8';
	 * const { contentType, charSet } = parseContentType(header);
	 * console.log(contentType); // 'json'
	 * console.log(charSet); // 'utf-8'
	 * ```
	 */
	parseContentType: (header: string): { format: BebopContentType; charSet: string | undefined; raw: string } => {
		if (!header) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'invalid request: no content type header');
		}
		const tempoIndex = header.indexOf('application/tempo');
		if (tempoIndex === -1) {
			throw new TempoError(
				TempoStatusCode.INVALID_ARGUMENT,
				'invalid request: content type does not include application/tempo',
			);
		}

		const formatStartIndex = tempoIndex + 'application/tempo'.length;
		const formatEndIndex =
			header.indexOf(';', formatStartIndex) !== -1 ? header.indexOf(';', formatStartIndex) : header.length;
		const format = header.slice(formatStartIndex + 1, formatEndIndex); // +1 to exclude '+'

		if (format !== 'bebop' && format !== 'json') {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, `invalid content type: unknown format ${format}`);
		}
		let charSet: string | undefined = undefined;
		const charsetIndex = header.indexOf('charset=');

		if (charsetIndex !== -1) {
			const charSetStartIndex = charsetIndex + 'charset='.length;
			const charSetEndIndex =
				header.indexOf(';', charSetStartIndex) !== -1 ? header.indexOf(';', charSetStartIndex) : header.length;
			charSet = header.slice(charSetStartIndex, charSetEndIndex);
		}
		return { format: format as BebopContentType, charSet, raw: header };
	},
};
