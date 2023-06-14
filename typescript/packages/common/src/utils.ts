import { TempoError } from './error';
import { TempoStatusCode } from './status';

/**
 * Parses a string into an int. Throws an error if the string is not a valid int.
 * @param value - the string to parse
 * @returns the parsed int
 */
const tryParseInt = (value: string): number => {
	const num = parseFloat(value);
	if (isNaN(num) || !isFinite(num) || num % 1 !== 0) {
		throw new TempoError(TempoStatusCode.INTERNAL, `Invalid int: ${value}`);
	}
	return num;
};

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
const isAsyncGeneratorFunction = <T>(obj: any): obj is AsyncGenerator<T, void, undefined> => {
	return (
		obj !== undefined &&
		typeof obj === 'function' &&
		obj.constructor &&
		obj.constructor.name === 'AsyncGeneratorFunction'
	);
};

// Instantiate a new 'TextEncoder' and export it.
const textEncoder = new TextEncoder();

// Instantiate a new 'TextDecoder' and export it.
const textDecoder = new TextDecoder();

/**
 * Builds a user agent string based on the given parameters.
 *
 * @param language - The language used in the tempo implementation.
 * @param version - The version of the tempo implementation.
 * @param variant - Optional variant of the tempo implementation.
 * @param additionalProperties - Optional additional properties to include in the user agent string.
 * @returns A formatted user agent string.
 */
const buildUserAgent = (
	language: string,
	version: string,
	variant?: string,
	additionalProperties?: Record<string, any>,
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
};

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
 * Determines the name of the current JavaScript runtime environment.
 * @returns The name of the current JavaScript runtime environment.
 */
const getEnvironmentName = () => {
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
};

/**
 * Utility object that provides access to common utility functions.
 */
export const TempoUtil = {
	/**
	 * Refers to the {@link tryParseInt} function. Please see its TSDoc for details.
	 */
	tryParseInt,

	/**
	 * Refers to the {@link textEncoder} constant. Please see its TSDoc for details.
	 */
	textEncoder,

	/**
	 * Refers to the {@link textDecoder} constant. Please see its TSDoc for details.
	 */
	textDecoder,

	/**
	 * Refers to the {@link buildUserAgent} function. Please see its TSDoc for details.
	 */
	buildUserAgent,
	/**
	 * Gets the name of the current JavaScript runtime environment.
	 */
	getEnvironmentName,
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
	isAsyncGeneratorFunction,
};
