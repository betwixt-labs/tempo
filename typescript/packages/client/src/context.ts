import { Metadata } from '@tempojs/common';

/**
 * Represents a client context that contains metadata for outgoing request and incoming responses.
 */
export class ClientContext {
	private _outgoingMetadata: Metadata;
	private _incomingMetadata: Metadata;

	/**
	 * Protected constructor that initializes the outgoing and incoming metadata.
	 */
	protected constructor() {
		this._outgoingMetadata = new Metadata();
		this._incomingMetadata = new Metadata();
	}

	/**
	 * Creates a new instance of the ClientContext.
	 * @returns A new instance of ClientContext.
	 */
	public static createContext(): ClientContext {
		return new ClientContext();
	}

	/**
	 * Gets the outgoing metadata on the request.
	 * @returns The metadata associated with outgoing requests.
	 */
	public get outgoingMetadata(): Metadata {
		return this._outgoingMetadata;
	}

	/**
	 * Gets the incoming metadata on the response.
	 * @returns The metadata associated with incoming response.
	 */
	public get incomingMetadata(): Metadata {
		return this._incomingMetadata;
	}

	/**
	 * Sets the incoming metadata.
	 * @param metadata - The metadata to be associated with incoming response.
	 */
	public set incomingMetadata(metadata: Metadata) {
		this._incomingMetadata = metadata;
	}
}
