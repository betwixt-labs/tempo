import { Deadline, Metadata, Credential } from '@tempojs/common';
import { AuthContext } from './auth';

/**
 * Interface for an incoming context.
 * Contains metadata, headers, and deadline values.
 */
export interface IncomingContext {
	/**
	 * Metadata object containing incoming metadata.
	 */
	metadata?: Metadata;

	/**
	 * Headers object containing incoming headers.
	 */
	headers: Headers;

	/**
	 * Deadline for the incoming context.
	 */
	deadline?: Deadline;
}

/**
 * Interface for an outgoing context.
 * Contains a metadata object that will be set on the outgoing response.
 */
export interface OutgoingContext {
	/**
	 * Metadata object that will be set on the outgoing response.
	 */
	metadata: Metadata;
	/**
	 * Credential that will be set on the outgoing response using the 'tempo-credential' header.
	 */
	credential?: Credential;
}

export class ServerContext {
	/**
	 * The authentication context for the incoming request.
	 */
	private authContext?: AuthContext;

	/**
	 * Creates a new instance of ServerContext.
	 * @param incomingContext - The incoming context for the current request.
	 * @param outgoingContext - The outgoing context for the current request.
	 * @param environment - The environment in which the method is executing.
	 */
	constructor(
		private incomingContext: IncomingContext,
		private outgoingContext: OutgoingContext,
		public environment: any,
	) {}

	/**
	 * Retrieves the environment object, casted to the specified type.
	 *
	 * @template TEnvironment - The desired type for the environment object.
	 * @returns The environment object casted to the specified type.
	 */
	public getEnvironment<TEnvironment>(): TEnvironment {
		return this.environment as TEnvironment;
	}

	/**
	 * Sets the authentication context for the incoming request.
	 * @param authContext - the context that will be associated with the incoming request.
	 */
	public setAuthContext(authContext: AuthContext): void {
		this.authContext = authContext;
	}

	/**
	 * Gets the auth context of the incoming request.
	 * @returns The authentication context for the incoming request.
	 */
	public getAuthContext(): AuthContext | undefined {
		return this.authContext;
	}

	freeze(): void {
		this.outgoingContext.metadata.freeze();
	}

	/**
	 * Retrieves the headers of the client that initiated the Tempo server call.
	 *
	 * @returns {Headers} - The headers of the client that initiated the Tempo server call.
	 */
	clientHeaders(): Headers {
		return this.incomingContext.headers;
	}

	/**
	 * Retrieves the metadata of the client that initiated the Tempo server call.
	 *
	 * @returns {Metadata} - The metadata of the client that initiated the Tempo server call.
	 */
	clientMetadata(): Metadata | undefined {
		return this.incomingContext.metadata;
	}
	/**
	 * Retrieves the deadline of the client that initiated the Tempo server call.
	 * @returns {Deadline} - The deadline of the client that initiated the Tempo server call.
	 */
	clientDeadline(): Deadline | undefined {
		return this.incomingContext.deadline;
	}

	/**
	 * Appends a key-value pair to the outgoing context for the Tempo server call.
	 *
	 * @param {string} key - The key of the metadata to append.
	 * @param {string | string[]} value - The value(s) to append to the metadata.
	 *
	 * @returns {void}
	 */
	appendToOutgoingContext(key: string, value: string | string[]): void {
		if (Array.isArray(value)) {
			value.forEach((v) => this.outgoingContext.metadata.append(key, v));
		} else {
			this.outgoingContext.metadata.append(key, value);
		}
	}

	/**
	 * Sets the credential for the outgoing context on the tempo-credential header.
	 * @param credential The credential to set on the outgoing context.
	 */
	setOutgoingCredential(credential: Credential): void {
		this.outgoingContext.credential = credential;
	}

	/**
	 * Retrieves the credential for the outgoing context to set on
	 * @returns The credential or undefined if none have been set
	 */
	getOutgoingCredential(): Credential | undefined {
		return this.outgoingContext.credential;
	}

	/**
	 * Sets a key-value pair in the outgoing context for the Tempo server call.
	 *
	 * @param {string} key - The key of the metadata to set.
	 * @param {string} value - The value to set in the metadata.
	 *
	 * @returns {void}
	 */
	setToOutgoingContext(key: string, value: string): void {
		this.outgoingContext.metadata.set(key, value);
	}
}
