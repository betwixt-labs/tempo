import { IncomingHttpHeaders } from 'http';

/**
 * `IFetchHeaders` is an interface that mimics the standard Fetch API Headers interface,
 * providing methods for fetching and checking the existence of header values.
 *
 * @interface IFetchHeaders
 */
interface IFetchHeaders {
	get(name: string): string | null;
	has(name: string): boolean;
}

/**
 * `FetchHeadersAdapter` is a class that implements the `IFetchHeaders` interface,
 * providing a way to work with incoming HTTP headers as if they were a standard Fetch API Headers object.
 *
 * @export
 * @class FetchHeadersAdapter
 * @implements {IFetchHeaders}
 */
export class FetchHeadersAdapter implements IFetchHeaders {
	private headers: Map<string, string>;

	/**
	 * Creates an instance of FetchHeadersAdapter.
	 *
	 * @param {IncomingHttpHeaders} incomingHeaders - The incoming HTTP headers to adapt to the Fetch API Headers interface.
	 * @memberof FetchHeadersAdapter
	 */
	constructor(incomingHeaders: IncomingHttpHeaders) {
		this.headers = new Map<string, string>();
		for (const [key, value] of Object.entries(incomingHeaders)) {
			if (typeof value === 'string') {
				this.headers.set(key.toLowerCase(), value);
			}
		}
	}

	/**
	 * Retrieves the header value associated with the provided header name.
	 *
	 * @param {string} name - The name of the header to retrieve.
	 * @returns {string | null} The value of the header, or null if it is not found.
	 * @memberof FetchHeadersAdapter
	 */
	get(name: string): string | null {
		const value = this.headers.get(name.toLowerCase());
		return value !== undefined ? value : null;
	}

	/**
	 * Checks if the provided header name exists in the headers.
	 *
	 * @param {string} name - The name of the header to check.
	 * @returns {boolean} True if the header exists, false otherwise.
	 * @memberof FetchHeadersAdapter
	 */
	has(name: string): boolean {
		return this.headers.has(name.toLowerCase());
	}
}
