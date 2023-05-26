import { IncomingHttpHeaders } from 'http';

/**
 * `IFetchHeaders` is an interface that mimics the standard Fetch API Headers interface,
 * providing methods for fetching and checking the existence of header values.
 *
 * @interface IFetchHeaders
 */
interface IFetchHeaders {
	get(name: string): string | undefined;
	has(name: string): boolean;
	forEach(callback: (value: string, name: string) => void): void;
	keys(): IterableIterator<string>;
	values(): IterableIterator<string>;
	entries(): IterableIterator<[string, string]>;
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
	private readonly headers: Map<string, string>;

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
	 * Retrieves the first header value associated with the provided header name.
	 *
	 * @param {string} name - The name of the header to retrieve.
	 * @returns {string | undefined} The value of the header, or undefined if it is not found.
	 * @memberof FetchHeadersAdapter
	 */
	get(name: string): string | undefined {
		return this.headers.get(name.toLowerCase());
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

	/**
	 * Executes the provided callback function for each header.
	 *
	 * @param {(value: string, name: string) => void} callback - The callback function to execute for each header.
	 * @memberof FetchHeadersAdapter
	 */
	forEach(callback: (value: string, name: string) => void): void {
		this.headers.forEach(callback);
	}

	/**
	 * Returns an iterator that contains the names (keys) of all headers.
	 *
	 * @returns {IterableIterator<string>} An iterator for the names (keys) of all headers.
	 * @memberof FetchHeadersAdapter
	 */
	*keys(): IterableIterator<string> {
		yield* this.headers.keys();
	}

	/**
	 * Returns an iterator that contains the values of all headers.
	 *
	 * @returns {IterableIterator<string>} An iterator for the values of all headers.
	 * @memberof FetchHeadersAdapter
	 */
	*values(): IterableIterator<string> {
		yield* this.headers.values();
	}

	/**
	 * Returns an iterator that contains all key/value pairs of the headers.
	 *
	 * @returns {IterableIterator<[string, string]>} An iterator for all key/value pairs of the headers.
	 * @memberof FetchHeadersAdapter
	 */
	*entries(): IterableIterator<[string, string]> {
		yield* this.headers.entries();
	}
}
