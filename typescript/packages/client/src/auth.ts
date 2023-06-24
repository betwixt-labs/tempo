import { Credential, parseCredential, stringifyCredential } from '@tempojs/common';

/**
 * A type representing an HTTP header with a name and value.
 */
type Header = { name: string; value: string };

/**
 * An interface defining the methods required for a credential storage strategy.
 */
export interface CredentialStorage {
	/**
	 * Retrieves stored credential for a given key.
	 * @param key - The key associated with the stored credential.
	 * @returns A Promise that resolves with the credential, or undefined if not found.
	 */
	getCredential(key: string): Promise<Credential | undefined>;

	/**
	 * Stores credential for a given key.
	 * @param key - The key associated with the credential to store.
	 * @param credential - The credential to store.
	 * @returns A Promise that resolves when the credential have been stored.
	 */
	storeCredential(key: string, credential: Credential): Promise<void>;

	/**
	 * Removes the credential stored for a given key.
	 * @param key - The key associated with the credential to store.
	 */
	removeCredential(key: string): Promise<void>;
}

/**
 * An implementation of CredentialStorage using the browser's localStorage.
 */
export class LocalStorageStrategy implements CredentialStorage {
	async getCredential(key: string): Promise<Credential | undefined> {
		const storedValue = localStorage.getItem(key);
		if (!storedValue) return undefined;
		return parseCredential(storedValue);
	}

	async storeCredential(key: string, credential: Credential): Promise<void> {
		localStorage.setItem(key, stringifyCredential(credential));
	}

	async removeCredential(key: string): Promise<void> {
		localStorage.removeItem(key);
	}
}

/**
 * An implementation of CredentialStorage using the browser's sessionStorage.
 */
export class SessionStorageStrategy implements CredentialStorage {
	async getCredential(key: string): Promise<Credential | undefined> {
		const storedValue = sessionStorage.getItem(key);
		if (!storedValue) return undefined;
		return parseCredential(storedValue);
	}

	async storeCredential(key: string, credential: Credential): Promise<void> {
		sessionStorage.setItem(key, stringifyCredential(credential));
	}

	async removeCredential(key: string): Promise<void> {
		sessionStorage.removeItem(key);
	}
}

/**
 * A no-operation implementation of CredentialStorage that does not store or retrieve credential.
 */
export class NoStorageStrategy implements CredentialStorage {
	async getCredential(_key: string): Promise<Credential | undefined> {
		return undefined;
	}

	async storeCredential(_key: string, _credential: Credential): Promise<void> {
		// No storage implementation
	}

	async removeCredential(_key: string): Promise<void> {
		// No storage implementation
	}
}

/**
 * An abstract class representing the base for all CallCredential implementations.
 */
export abstract class CallCredential {
	protected constructor(protected storage: CredentialStorage, protected key: string) {}

	/**
	 * Retrieves stored credential.
	 * @returns A Promise that resolves with the credential, or undefined if not found.
	 */
	public abstract getCredential(): Promise<Credential | undefined>;

	/**
	 * Retrieves the HTTP header to be used for authentication.
	 * @returns A Promise that resolves with the header, or undefined if not applicable.
	 */
	public abstract getHeader(): Promise<Header | undefined>;

	/**
	 * Stores credential.
	 * @param credential - The credential to store.
	 * @returns A Promise that resolves when the credential have been stored.
	 */
	public abstract storeCredential(credential: Credential): Promise<void>;

	/**
	 * Remove credential.
	 * @returns A Promise that resolves when the credential have been removed.
	 */
	public async removeCredential(): Promise<void> {
		await this.storage.removeCredential(this.key);
	}
}

/**
 * An implementation of CallCredential for insecure (unauthenticated) channels.
 */
export class InsecureChannelCredential extends CallCredential {
	/**
	 * Retrieves stored credential. Always returns undefined for insecure channels.
	 * @returns A Promise that resolves with undefined.
	 */
	public override getCredential(): Promise<Credential | undefined> {
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
	 * Stores credential. Does nothing for insecure channels.
	 * @param credential - The credential to store.
	 * @returns A Promise that resolves immediately.
	 */
	public override storeCredential(_credential: Credential): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Creates a new instance of InsecureChannelCredential.
	 * @returns A new instance of InsecureChannelCredential.
	 */
	public static create(): InsecureChannelCredential {
		return new InsecureChannelCredential(new NoStorageStrategy(), '');
	}
}

/**
 * An implementation of CallCredential for Bearer token authentication.
 */
export class BearerCredential extends CallCredential {
	constructor(storage: CredentialStorage, key: string) {
		super(storage, key);
	}

	/**
	 * Retrieves stored credential from the storage strategy.
	 * @returns A Promise that resolves with the credential, or undefined if not found.
	 */
	public async getCredential(): Promise<Credential | undefined> {
		return await this.storage.getCredential(this.key);
	}

	/**
	 * Retrieves the HTTP header for Bearer token authentication.
	 * @returns A Promise that resolves with the header, or undefined if the token is not available.
	 */
	public override async getHeader(): Promise<Header | undefined> {
		const credential = await this.getCredential();
		if (!credential) return undefined;

		const token = credential['access_token'] || credential['token'] || credential['accessToken'];
		if (!token) return undefined;

		return { name: 'Authorization', value: `Bearer ${token}` };
	}

	/**
	 * Stores credential using the storage strategy.
	 * @param credential - The credential to store.
	 * @returns A Promise that resolves when the credential have been stored.
	 */
	public async storeCredential(credential: Credential): Promise<void> {
		await this.storage.storeCredential(this.key, credential);
	}

	/**
	 * Creates a new instance of BearerCredential with the specified storage strategy and key.
	 * @param storage - The storage strategy to use for storing and retrieving credential.
	 * @param key - The key associated with the credential.
	 * @returns A new instance of BearerCredential.
	 */
	public static create(storage: CredentialStorage, key: string): BearerCredential {
		return new BearerCredential(storage, key);
	}
}
