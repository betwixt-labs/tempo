import { TempoError, TempoStatusCode } from '@tempojs/common';

/**
 * Represents an authentication property with a name and value.
 */
export class AuthProperty {
	constructor(public readonly name: string, public readonly value: unknown) {}
	/**
	 * Retrieves the value of the authentication property as the specified type.
	 * @template T - The expected type of the value.
	 * @returns The value of the authentication property cast to the specified type.
	 */
	public getValue<T>(): T {
		return this.value as T;
	}
}

/**
 * Represents an authentication context that contains authentication properties for a peer identity.
 */
export class AuthContext {
	private isAuthenticated: boolean;
	private properties: Map<string, Array<AuthProperty>>;
	private _peerIdentityKey?: string;

	/**
	 * Constructs a new AuthContext instance.
	 * @param peerIdentityKey - The key that corresponds to the peer identity and all it's properties.
	 * @param properties - An optional map of authentication properties.
	 */
	constructor(peerIdentityKey?: string, properties?: Map<string, Array<AuthProperty>>) {
		this.isAuthenticated = false;
		this.properties = properties ?? new Map<string, Array<AuthProperty>>();
		if (peerIdentityKey) {
			this._peerIdentityKey = peerIdentityKey;
			this.isAuthenticated = true;
		}
	}

	/**
	 * Adds an authentication property to the context.
	 * @param key - The key that corresponds to the authentication property.
	 * @param propertyName - The name of the authentication property.
	 * @param propertyValue - The value of the authentication property.
	 */
	public addProperty(key: string, propertyName: string, propertyValue: unknown): void {
		if (key === undefined || key === null)
			throw new TempoError(TempoStatusCode.INTERNAL, 'key cannot be null or undefined');
		if (propertyName === undefined || propertyName === null)
			throw new TempoError(TempoStatusCode.INTERNAL, 'propertyName cannot be null or undefined');
		if (propertyValue === undefined || propertyValue === null)
			throw new TempoError(TempoStatusCode.INTERNAL, 'propertyValue cannot be null or undefined');
		if (this.properties.has(key)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			this.properties.get(key)!.push(new AuthProperty(propertyName, propertyValue));
		} else {
			this.properties.set(key, [new AuthProperty(propertyName, propertyValue)]);
		}
	}

	/**
	 * Returns an array of authentication properties for the peer identity.
	 * If the peer is not authenticated or no peer identity key is set, undefined will be returned.
	 * @returns An array of authentication properties for the peer identity or undefined if none exist.
	 */
	public get peerIdentity(): Array<AuthProperty> | undefined {
		if (!this.isPeerAuthenticated) {
			return undefined;
		}
		if (!this._peerIdentityKey) {
			return undefined;
		}
		return this.getProperties(this._peerIdentityKey);
	}

	/**
	 * Returns the authentication property with the given name.
	 * If no property with the given name exists, undefined will be returned.
	 * @param key - The key that corresponds to the authentication property.
	 * @param name - The name of the authentication property to find.
	 * @returns The authentication property with the given name or undefined if none exist.
	 */
	public findPropertyByName(key: string, name: string): AuthProperty | undefined {
		const properties = this.properties.get(key);
		if (properties === undefined) {
			return undefined;
		}
		return properties.find((property) => property.name === name);
	}

	/**
	 * Returns an array of authentication properties with the given name.
	 * If no properties with the given name exist, undefined will be returned.
	 * @param key - The key that corresponds to the authentication properties.
	 * @param name - The name of the authentication properties to find.
	 * @returns An array of authentication properties with the given name or undefined if none exist.
	 */
	public findPropertiesByName(key: string, name: string): Array<AuthProperty> | undefined {
		const properties = this.properties.get(key);
		if (properties === undefined) {
			return undefined;
		}
		return properties.filter((property) => property.name === name);
	}

	/**
	 * Returns an array of authentication properties for the given key.
	 * If no properties exist for the given key, undefined will be returned.
	 * @param key - The key that corresponds to the authentication properties.
	 * @returns An array of authentication properties for the given key or undefined if none exist.
	 */
	public getProperties(key: string): Array<AuthProperty> | undefined {
		return this.properties.get(key);
	}

	/**
	 * Returns a boolean indicating whether the peer is authenticated or not.
	 * @returns A boolean indicating whether the peer is authenticated or not.
	 */
	public get isPeerAuthenticated(): boolean {
		return this._peerIdentityKey !== undefined && this.isAuthenticated;
	}

	/**
	 * Returns the key that corresponds to the peer identity and all its properties.
	 * If the peer is not authenticated, undefined will be returned.
	 * @returns The key that corresponds to the peer identity and all its properties or undefined if the peer is not authenticated.
	 */
	public get peerIdentityKey(): string | undefined {
		if (!this.isAuthenticated) {
			return undefined;
		}
		return this._peerIdentityKey;
	}

	/**
	 * Sets the peer identity key for the authentication context.
	 * @param key - The key that corresponds to the peer identity and all its properties.
	 * @throws TempoError if the key does not exist in properties.
	 */
	public set peerIdentityKey(key: string | undefined) {
		if (key === undefined) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'cannot set peer identity key: key is undefined');
		}
		if (!this.properties.has(key)) {
			throw new TempoError(
				TempoStatusCode.INTERNAL,
				`cannot set peer identity key: ${key} does not exist in properties`,
			);
		}
		this._peerIdentityKey = key;
		this.isAuthenticated = true;
	}
}
