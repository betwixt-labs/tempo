import { Credentials, parseCredentials, stringifyCredentials } from '@tempojs/common';

/**
 * A type representing an HTTP header with a name and value.
 */
type Header = { name: string; value: string };

/**
 * An interface defining the methods required for a credentials storage strategy.
 */
export interface CredentialsStorage {
	/**
	 * Retrieves stored credentials for a given key.
	 * @param key - The key associated with the stored credentials.
	 * @returns A Promise that resolves with the credentials, or undefined if not found.
	 */
	getCredentials(key: string): Promise<Credentials | undefined>;

	/**
	 * Stores credentials for a given key.
	 * @param key - The key associated with the credentials to store.
	 * @param credentials - The credentials to store.
	 * @returns A Promise that resolves when the credentials have been stored.
	 */
	storeCredentials(key: string, credentials: Credentials): Promise<void>;

	/**
	 * Removes the credentials stored for a given key.
	 * @param key - The key associated with the credentials to store.
	 */
	removeCredentials(key: string): Promise<void>;
}

/**
 * An implementation of CredentialsStorage using the browser's localStorage.
 */
export class LocalStorageStrategy implements CredentialsStorage {
	async getCredentials(key: string): Promise<Credentials | undefined> {
		const storedValue = localStorage.getItem(key);
		if (!storedValue) return undefined;
		return parseCredentials(storedValue);
	}

	async storeCredentials(key: string, credentials: Credentials): Promise<void> {
		localStorage.setItem(key, stringifyCredentials(credentials));
	}

	async removeCredentials(key: string): Promise<void> {
		localStorage.removeItem(key);
	}
}

/**
 * An implementation of CredentialsStorage using the browser's sessionStorage.
 */
export class SessionStorageStrategy implements CredentialsStorage {
	async getCredentials(key: string): Promise<Credentials | undefined> {
		const storedValue = sessionStorage.getItem(key);
		if (!storedValue) return undefined;
		return parseCredentials(storedValue);
	}

	async storeCredentials(key: string, credentials: Credentials): Promise<void> {
		sessionStorage.setItem(key, stringifyCredentials(credentials));
	}

	async removeCredentials(key: string): Promise<void> {
		sessionStorage.removeItem(key);
	}
}

/**
 * A no-operation implementation of CredentialsStorage that does not store or retrieve credentials.
 */
export class NoStorageStrategy implements CredentialsStorage {
	async getCredentials(_key: string): Promise<Credentials | undefined> {
		return undefined;
	}

	async storeCredentials(_key: string, _credentials: Credentials): Promise<void> {
		// No storage implementation
	}

	async removeCredentials(_key: string): Promise<void> {
		// No storage implementation
	}
}

/**
 * An abstract class representing the base for all CallCredentials implementations.
 */
export abstract class CallCredentials {
	protected constructor(protected storage: CredentialsStorage, protected key: string) {}

	/**
	 * Retrieves stored credentials.
	 * @returns A Promise that resolves with the credentials, or undefined if not found.
	 */
	public abstract getCredentials(): Promise<Credentials | undefined>;

	/**
	 * Retrieves the HTTP header to be used for authentication.
	 * @returns A Promise that resolves with the header, or undefined if not applicable.
	 */
	public abstract getHeader(): Promise<Header | undefined>;

	/**
	 * Stores credentials.
	 * @param credentials - The credentials to store.
	 * @returns A Promise that resolves when the credentials have been stored.
	 */
	public abstract storeCredentials(credentials: Credentials): Promise<void>;

	/**
	 * Remove credentials.
	 * @param credentials - The credentials to remove.
	 * @returns A Promise that resolves when the credentials have been removed.
	 */
	public async removeCredentials(): Promise<void> {
		await this.storage.removeCredentials(this.key);
	}
}

/**
 * An implementation of CallCredentials for insecure (unauthenticated) channels.
 */
export class InsecureChannelCredentials extends CallCredentials {
	/**
	 * Retrieves stored credentials. Always returns undefined for insecure channels.
	 * @returns A Promise that resolves with undefined.
	 */
	public override getCredentials(): Promise<Credentials | undefined> {
		return Promise.resolve(undefined);
	}

	/**
	 * Retrieves the HTTP header for authentication. Always returns undefined for insecure channels.
	 * @returns A Promise that resolves with undefined.
	 */
	public override getHeader(): Promise<Header | undefined> {
		return Promise.resolve(undefined);
	}

	/**
	 * Stores credentials. Does nothing for insecure channels.
	 * @param credentials - The credentials to store.
	 * @returns A Promise that resolves immediately.
	 */
	public override storeCredentials(_credentials: Credentials): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Creates a new instance of InsecureChannelCredentials.
	 * @returns A new instance of InsecureChannelCredentials.
	 */
	public static create(): InsecureChannelCredentials {
		return new InsecureChannelCredentials(new NoStorageStrategy(), '');
	}
}

/**
 * An implementation of CallCredentials for Bearer token authentication.
 */
export class BearerCredentials extends CallCredentials {
	constructor(storage: CredentialsStorage, key: string) {
		super(storage, key);
	}

	/**
	 * Retrieves stored credentials from the storage strategy.
	 * @returns A Promise that resolves with the credentials, or undefined if not found.
	 */
	public async getCredentials(): Promise<Credentials | undefined> {
		return await this.storage.getCredentials(this.key);
	}

	/**
	 * Retrieves the HTTP header for Bearer token authentication.
	 * @returns A Promise that resolves with the header, or undefined if the token is not available.
	 */
	public override async getHeader(): Promise<Header | undefined> {
		const credentials = await this.getCredentials();
		if (!credentials) return undefined;

		const token = credentials['access_token'] || credentials['token'] || credentials['accessToken'];
		if (!token) return undefined;

		return { name: 'Authorization', value: `Bearer ${token}` };
	}

	/**
	 * Stores credentials using the storage strategy.
	 * @param credentials - The credentials to store.
	 * @returns A Promise that resolves when the credentials have been stored.
	 */
	public async storeCredentials(credentials: Credentials): Promise<void> {
		await this.storage.storeCredentials(this.key, credentials);
	}

	/**
	 * Creates a new instance of BearerCredentials with the specified storage strategy and key.
	 * @param storage - The storage strategy to use for storing and retrieving credentials.
	 * @param key - The key associated with the credentials.
	 * @returns A new instance of BearerCredentials.
	 */
	public static create(storage: CredentialsStorage, key: string): BearerCredentials {
		return new BearerCredentials(storage, key);
	}
}
