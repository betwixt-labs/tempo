/**
 * Represents the type of Tempo method.
 * Each method type corresponds to a different communication model.
 */
export enum MethodType {
	/**
	 * Unary method type.
	 * Represents a method where the client sends a single request and receives a single response.
	 */
	Unary,

	/**
	 * ServerStream method type.
	 * Represents a method where the client sends a single request and receives a stream of responses.
	 */
	ServerStream,

	/**
	 * ClientStream method type.
	 * Represents a method where the client sends a stream of requests and receives a single response.
	 */
	ClientStream,

	/**
	 * DuplexStream method type.
	 * Represents a method where the client and server send a stream of messages to each other simultaneously.
	 */
	DuplexStream,
}
