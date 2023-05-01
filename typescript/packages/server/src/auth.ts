/**
 * Type definition for authentication property values.
 */
export type AuthPropertyValue = string | number | boolean;

/**
 * Represents an authentication property with a name and value.
 */
export class AuthProperty {
	constructor(public name: string, public value: AuthPropertyValue) {}

	/**
	 * Retrieves the value of the authentication property as the specified type.
	 * @template T - The expected type of the value.
	 * @returns The value of the authentication property cast to the specified type.
	 */
	public getValue<T extends AuthPropertyValue>(): T {
		return this.value as T;
	}
}

/**
 * Authentication context for a call.
 * AuthContext is the only reliable source of truth when it comes to authenticating calls.
 */
export class AuthContext {
	private isAuthenticated: boolean;
	private properties: Map<string, Array<AuthProperty>>;
	private peerIdentityPropertyName?: string;

	/**
	 * Constructs a new AuthContext instance.
	 * @param peerIdentityPropertyName - The name of the property that represents the peer identity.
	 * @param properties - An optional map of authentication properties.
	 */
	constructor(peerIdentityPropertyName?: string, properties?: Map<string, Array<AuthProperty>>) {
		this.isAuthenticated = false;
		this.properties = properties || new Map<string, Array<AuthProperty>>();
		if (peerIdentityPropertyName) {
			this.peerIdentityPropertyName = peerIdentityPropertyName;
			this.isAuthenticated = true;
		}
	}

	/**
	 * Adds an authentication property to the context.
	 * @param name - The name of the authentication property.
	 * @param value - The value of the authentication property.
	 */
	public addProperty(name: string, value: AuthPropertyValue): void {
		if (this.properties.has(name)) {
			this.properties.get(name)!.push(new AuthProperty(name, value));
		} else {
			this.properties.set(name, [new AuthProperty(name, value)]);
		}
	}

	/**
	 * Gets properties that represent the peer identity (there can be more than one).
	 * Returns undefined if the peer is not authenticated.
	 */
	public get peerIdentity(): Array<AuthProperty> | undefined {
		if (!this.isPeerAuthenticated) {
			return undefined;
		}
		if (!this.peerIdentityPropertyName) {
			return undefined;
		}
		return this.properties.get(this.peerIdentityPropertyName);
	}

	/**
	 * Returns the auth properties with the given name (there can be more than one).
	 * If no properties with the given name exist, undefined will be returned.
	 * @param name - The name of the authentication properties to find.
	 * @returns An array of authentication properties with the given name or undefined if none exist.
	 */
	public findPropertiesByName(name: string): Array<AuthProperty> | undefined {
		return this.properties.get(name);
	}

	/**
	 * Returns true if the peer is authenticated.
	 */
	public get isPeerAuthenticated(): boolean {
		return this.peerIdentityPropertyName !== undefined && this.isAuthenticated;
	}

	/**
	 * Returns the name of the property that represents the peer identity.
	 * If the peer is not authenticated, undefined is returned.
	 */
	public getPeerIdentityPropertyName(): string | undefined {
		if (!this.isAuthenticated) {
			return undefined;
		}
		return this.peerIdentityPropertyName;
	}

	/**
	 * Sets the name of the property that represents the peer identity.
	 * @param name - The name of the property to be set as the peer identity property.
	 * @returns True if the property name was successfully set, false otherwise.
	 */
	public setPeerIdentityPropertyName(name: string): boolean {
		if (this.properties.has(name)) {
			return false;
		}
		this.peerIdentityPropertyName = name;
		this.isAuthenticated = true;
		return true;
	}
}
