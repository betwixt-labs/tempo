import {
	TempoLogger,
	TempoError,
	TempoStatusCode,
	ConsoleLogger,
	Deadline,
	Metadata,
	parseCredential,
	ExecutionEnvironment,
	TempoVersion,
	Credential,
	tempoStream,
	MethodType,
	HookRegistry,
} from '@tempojs/common';
import { TempoChannelOptions, CallOptions } from './options';
import { BebopRecord } from 'bebop';
import { BaseClient, ClientConstructor } from './client';
import { ClientContext } from './context';
import { MethodInfo } from './method';
import { RetryPolicy } from './retry';
import { TempoUtil } from '@tempojs/common';
import { CallCredential, InsecureChannelCredential } from './auth';
import { BebopContentType } from '@tempojs/common';

/**
 * The BaseChannel class represents the foundation for implementing specific
 * communication channels for Tempo.
 */
export abstract class BaseChannel {
	protected hooks?: HookRegistry<ClientContext, unknown> | undefined;
	protected readonly contentTypeValue: string;
	/**
	 * Constructs a BaseChannel instance.
	 * @param {URL} target - The target URL of the server.
	 * @param {TempoLogger} logger - The logger instance to use for logging.
	 * @param {BebopContentType} contentType - The content type to use for requests and responses.
	 */
	protected constructor(
		protected readonly target: URL,
		protected readonly logger: TempoLogger,
		protected readonly contentType: BebopContentType,
	) {
		const charSet = contentType === 'json' ? '; charset=utf-8' : '';
		this.contentTypeValue = `application/tempo+${contentType}${charSet}`;
	}

	/**
	 * A function to create an instance of a client class extending BaseClient.
	 * @template TClient - The type of the client extending BaseClient.
	 * @param {Constructor<TClient>} clientCtor - The constructor of the client extending BaseClient.
	 * @returns {TClient} - An instance of the specified client class.
	 */
	getClient<TClient extends BaseClient>(clientCtor: ClientConstructor<TClient>): TClient {
		return Object.seal(BaseClient.createInstance(clientCtor, this));
	}

	/**
	 * Sends a unary request to a server and returns the response.
	 *
	 * @template TRequest - The type of the request object, extending BebopRecord.
	 * @template TResponse - The type of the response object, extending BebopRecord.
	 * @param {TRequest} request - The request object to be sent.
	 * @param {ClientContext} context - The client context containing metadata for the request.
	 * @param {MethodInfo<TRequest, TResponse>} method - The method information for the RPC call.
	 * @param {CallOptions} [options] - Optional call options, such as retry policy and deadline.
	 * @returns {Promise<TResponse>} - A promise resolving to the response object.
	 * @throws {TempoError} - Throws a TempoError in case of any error during the request.
	 */
	public abstract startUnary<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		request: TRequest,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions,
	): Promise<TResponse>;

	/**
	 * Starts a client-streaming RPC.
	 *
	 * A client-streaming RPC is similar to a unary RPC, except that the client sends a stream of messages to the server instead of a single message.
	 * The server responds with a single message, typically but not necessarily after it has received all the client’s messages.
	 *
	 * @param generator - A function that returns an asynchronous generator for producing the client's messages.
	 * @param context - The client context.
	 * @param method - The method information.
	 * @param options - Optional call options.
	 * @returns A promise that resolves to the response message from the server.
	 */
	public abstract startClientStream<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		generator: () => AsyncGenerator<TRequest, void, undefined>,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions,
	): Promise<TResponse>;

	/**
	 * Starts a server-streaming RPC.
	 *
	 * A server-streaming RPC is similar to a unary RPC, except that the server returns a stream of messages in response to a client's request.
	 * After sending all its messages, the server's status details (status code and optional status message) are sent.
	 * This completes processing on the server side. The client completes once it has received all the server's messages.
	 *
	 * @param request - The request message sent by the client.
	 * @param context - The client context.
	 * @param method - The method information.
	 * @param options - Optional call options.
	 * @returns A function that returns an asynchronous generator for receiving the server's messages.
	 */
	public abstract startServerStream<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		request: TRequest,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions,
	): Promise<AsyncGenerator<TResponse, void, undefined>>;

	/**
	 * Starts a duplex-streaming RPC.
	 *
	 * A duplex-streaming RPC allows both the client and the server to send and receive a stream of messages.
	 *
	 * @param generator - A function that returns an asynchronous generator for producing the client's messages.
	 * @param context - The client context.
	 * @param method - The method information.
	 * @param options - Optional call options.
	 * @returns A function that returns an asynchronous generator for receiving the server's messages.
	 */
	public abstract startDuplexStream<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		generator: () => AsyncGenerator<TRequest, void, undefined>,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions,
	): Promise<AsyncGenerator<TResponse, void, undefined>>;

	public abstract removeCredential(): Promise<void>;
	public abstract getCredential(): Promise<Credential | undefined>;

	/**
	 * Defines a hook registry for the channel.
	 * @param hooks - The hook registry to be used.
	 */
	public useHooks<TEnvironment>(hooks: HookRegistry<ClientContext, TEnvironment>): void {
		this.hooks = hooks;
	}

	/**
	 * Serializes a request record to a Uint8Array based on the specified content type.
	 *
	 * @param request - The request record to be serialized.
	 * @param method - The method information.
	 * @returns A Uint8Array representing the serialized request record.
	 * @throws {TempoError} if the specified content type is not supported.
	 * @throws {BebopRuntimeError} if the request record cannot be serialized.
	 */
	protected serializeRequest<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		request: TRequest,
		method: MethodInfo<TRequest, TResponse>,
	): Uint8Array {
		switch (this.contentType) {
			case 'bebop':
				return method.serialize(request);
			case 'json':
				return TempoUtil.utf8GetBytes(method.toJSON(request));
			default:
				throw new TempoError(TempoStatusCode.UNKNOWN_CONTENT_TYPE, `invalid request content type: ${this.contentType}`);
		}
	}

	/**
	 * Deserializes a response record from a Uint8Array based on the specified content type.
	 *
	 * @param response - The response record to be deserialized.
	 * @param method - The method information.
	 * @returns The deserialized response record.
	 * @throws {TempoError} if the specified content type is not supported.
	 * @throws {BebopRuntimeError} When the response record cannot be serialized.
	 */
	protected deserializeResponse<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		response: Uint8Array,
		method: MethodInfo<TRequest, TResponse>,
	): TResponse {
		switch (this.contentType) {
			case 'bebop':
				return method.deserialize(response);
			case 'json':
				return method.fromJSON(TempoUtil.utf8GetString(response));
			default:
				throw new TempoError(
					TempoStatusCode.UNKNOWN_CONTENT_TYPE,
					`invalid response content type: ${this.contentType}`,
				);
		}
	}
}

/**
 * A function that checks if the current execution environment supports request streams.
 *
 * This function immediately invokes an IIFE (Immediately Invoked Function Expression) to check
 * whether the current environment supports creating Request objects with a ReadableStream as the body.
 *
 * The check is done by trying to create a new Request object with a ReadableStream as the body.
 * If the creation is successful and 'Content-Type' header doesn't exist in the created Request object,
 * and also 'duplex' property has been accessed during the Request object creation, it means the environment
 * supports request streams and the function returns true.
 *
 * If the current environment is either a browser or a web worker, and does not satisfy the conditions mentioned above,
 * the function will return false.
 *
 * If the current environment is neither a browser nor a web worker, the function assumes that it supports request streams
 * and returns true.
 *
 * @returns {boolean} Returns true if the current execution environment supports request streams, otherwise false.
 */
const supportsRequestStreams = (() => {
	if (ExecutionEnvironment.isBrowser || ExecutionEnvironment.isWebWorker) {
		try {
			let duplexAccessed = false;
			const hasContentType = new Request('', {
				body: new ReadableStream(),
				method: 'POST',
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				//@ts-ignore
				get duplex() {
					duplexAccessed = true;
					return 'half';
				},
			}).headers.has('Content-Type');
			return duplexAccessed && !hasContentType;
		} catch {
			return false;
		}
	}
	return true;
})();

/**
 * Represents a Tempo channel for communication with a remote server.
 */
export class TempoChannel extends BaseChannel {
	public static readonly defaultMaxRetryAttempts: number = 5;
	public static readonly defaultMaxReceiveMessageSize: number = 1024 * 1024 * 4; // 4 MB
	public static readonly defaultMaxSendMessageSize: number = 1024 * 1024 * 4; // 4 MB
	public static readonly defaultCredential: CallCredential = InsecureChannelCredential.create();
	public static readonly defaultContentType: BebopContentType = 'bebop';

	private readonly isSecure: boolean;
	private readonly maxReceiveMessageSize: number;
	private readonly credential: CallCredential;
	private readonly userAgent: string;

	/**
	 * Constructs a new TempoChannel instance.
	 *
	 * @param {URL} target - The target URL for the channel.
	 * @param {TempoChannelOptions} options - The configuration options for the channel.
	 * @protected
	 */
	protected constructor(target: URL, options: TempoChannelOptions) {
		super(
			target,
			options.logger ?? new ConsoleLogger('TempoChannel'),
			options.contentType ?? TempoChannel.defaultContentType,
		);
		this.logger.debug('creating new TempoChannel');
		this.isSecure = target.protocol === 'https:';
		this.credential = options.credential ?? TempoChannel.defaultCredential;
		if (
			!this.isSecure &&
			!(this.credential instanceof InsecureChannelCredential) &&
			options.unsafeUseInsecureChannelCallCredential !== true
		) {
			throw new Error('Cannot use secure credential with insecure channel');
		}
		this.maxReceiveMessageSize = options.maxReceiveMessageSize ?? TempoChannel.defaultMaxReceiveMessageSize;
		this.credential = options.credential ?? TempoChannel.defaultCredential;
		this.userAgent = TempoUtil.buildUserAgent('javascript', TempoVersion, undefined, {
			runtime: TempoUtil.getEnvironmentName(),
		});
		this.logger.debug(`created new TempoChannel for ${target.href} / ${this.userAgent}`);
	}

	/**
	 * Creates a new TempoChannel instance for the specified address.
	 *
	 * @overload
	 * @param {string} address - The target address as a string.
	 * @returns {TempoChannel} - A new TempoChannel instance.
	 */
	static forAddress(address: string): TempoChannel;
	/**
	 * Creates a new TempoChannel instance for the specified address.
	 *
	 * @overload
	 * @param {string} address - The target address as a string.
	 * @param {TempoChannelOptions} options - Configuration options for the channel.
	 * @returns {TempoChannel} - A new TempoChannel instance.
	 */
	static forAddress(address: string, options: TempoChannelOptions): TempoChannel;
	/**
	 * Creates a new TempoChannel instance for the specified address.
	 *
	 * @overload
	 * @param {URL} address - The target address as a URL object.
	 * @returns {TempoChannel} - A new TempoChannel instance.
	 */
	static forAddress(address: URL): TempoChannel;

	/**
	 * Creates a new TempoChannel instance for the specified address.
	 *
	 * @param {string | URL} address - The target address as a string or URL object.
	 * @param {TempoChannelOptions} [options] - Optional configuration options for the channel.
	 * @returns {TempoChannel} - A new TempoChannel instance.
	 */
	static forAddress(address: string | URL, options?: TempoChannelOptions): TempoChannel {
		if (!address) {
			throw new Error('no address');
		}
		if (typeof address === 'string') {
			address = new URL(address);
		}
		options ??= {};
		return new TempoChannel(address, options);
	}

	public override async removeCredential(): Promise<void> {
		await this.credential.removeCredential();
	}
	public override async getCredential(): Promise<Credential | undefined> {
		return await this.credential.getCredential();
	}

	/**
	 * Executes a function with retries according to the provided retry policy.
	 * The function will be retried if it fails with a TempoError and its status code is included in the retryableStatusCodes of the retry policy.
	 * If a deadline is provided, the deadline for each attempt will be managed by the provided deadline, but the deadline will not be reset upon each retry.
	 *
	 * @template T - The type of the result returned by the function.
	 * @param {((retryAttempt: number) => Promise<T>)} func - A function that returns a Promise with a result. The function will receive a number indicating the current retry attempt.
	 * @param {RetryPolicy} retryPolicy - An object defining the retry policy, including maxAttempts, initialBackoff, maxBackoff, backoffMultiplier, and retryableStatusCodes.
	 * @param {Deadline} [deadline] - An optional deadline object that manages the timeout for each attempt.
	 * @param {AbortController} [abortController] - An optional AbortController instance to cancel the function execution.
	 * @returns {Promise<T>} - A Promise that resolves with the result of the function if it completes within the deadline and retry policy constraints.
	 * @throws {Error} - If the function execution fails and the error does not match the retry policy, or if the maximum number of attempts is reached without a successful result.
	 */
	async executeWithRetry<T>(
		func: (retryAttempt: number) => Promise<T>,
		retryPolicy: RetryPolicy,
		deadline?: Deadline,
		abortController?: AbortController,
	): Promise<T> {
		let attempt = 0;
		let lastError: Error | undefined;

		const execute = deadline
			? (retryAttempt: number) => deadline.executeWithinDeadline(async () => await func(retryAttempt), abortController)
			: (retryAttempt: number) => func(retryAttempt);

		while (attempt < retryPolicy.maxAttempts) {
			try {
				// Attempt to execute the function within the deadline, if provided.
				const result = await execute(attempt);
				return result;
			} catch (error) {
				if (!(error instanceof Error)) {
					throw new TempoError(TempoStatusCode.UNKNOWN, `unexpected error`, { data: error });
				}
				lastError = error;
				// If error is not an instance of TempoError or the status code is not in retryableStatusCodes, throw the error.
				if (!(error instanceof TempoError) || !retryPolicy.retryableStatusCodes.includes(error.status)) {
					throw error;
				}

				// Calculate the backoff time for this attempt.
				const backoffTime = Math.min(
					retryPolicy.initialBackoff.multiply(Math.pow(retryPolicy.backoffMultiplier, attempt)).totalMilliseconds,
					retryPolicy.maxBackoff.totalMilliseconds,
				);

				// Add some jitter to the backoff time.
				const backoffWithJitter = backoffTime * (Math.random() * 0.5 + 0.75);

				// Wait for the backoff duration.
				await new Promise<void>((resolve) => setTimeout(resolve, backoffWithJitter));

				// Increment the attempt counter.
				attempt++;
			}
		}

		if (
			abortController &&
			lastError !== undefined &&
			!(lastError instanceof Error && lastError.name === 'AbortError') &&
			!(lastError instanceof TempoError && lastError.status === TempoStatusCode.ABORTED)
		) {
			abortController.abort();
		}

		return Promise.reject(
			lastError || new TempoError(TempoStatusCode.DEADLINE_EXCEEDED, 'Failed to execute function with retry policy'),
		);
	}

	/**
	 * Fetches data from the specified target using the provided request options.
	 *
	 * @param {RequestInit} init - The request options to be used with the fetch API.
	 * @returns {Promise<Response>} - A promise resolving to the Response object.
	 * @throws {TempoError} - Throws a TempoError with a specific TempoStatusCode in case of network issues,
	 *                        invalid URL, fetch abort, or any unexpected error.
	 * @private
	 */
	private async fetchData(init: RequestInit): Promise<Response> {
		try {
			return await fetch(this.target, init);
		} catch (error) {
			if (error instanceof Error) {
				// depending on the runtime (browser vs node) the error message may be different, but they all mean
				// they failed to connect to the target
				if (error.message.match(/(failed to fetch)|(load failed)|(fetch failed)/i)) {
					throw new TempoError(TempoStatusCode.UNAVAILABLE, 'RPC fetch failed to target', error);
					// this means the AbortController was signaled to abort the fetch
				} else if (error.name === 'AbortError') {
					throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', error);
				}
				throw new TempoError(TempoStatusCode.UNKNOWN, `unexpected error while fetching`, error);
			}
			throw new TempoError(TempoStatusCode.UNKNOWN, `unexpected error while fetching`, { data: error });
		}
	}

	/**
	 * Creates a `RequestInit` object for a given payload, context, method and optional call options.
	 * This object can be used to make an HTTP request using the Fetch API.
	 *
	 * @private
	 * @param {Uint8Array | ReadableStream<Uint8Array>} payload - The payload to be sent in the request.
	 * @param {ClientContext} context - The context of the client making the request.
	 * @param {MethodInfo<BebopRecord, BebopRecord>} method - Information about the method being called.
	 * @param {CallOptions | undefined} options - Optional configuration for the call.
	 * @returns {Promise<RequestInit>} A Promise resolving to the created `RequestInit` object.
	 * @throws {TempoError} Throws an error if there's a problem while getting the credential header.
	 */
	private async createRequest(
		payload: Uint8Array | ReadableStream<Uint8Array>,
		context: ClientContext,
		method: MethodInfo<BebopRecord, BebopRecord>,
		options?: CallOptions | undefined,
	): Promise<RequestInit> {
		// Set up request headers
		const headers = new Headers({
			'tempo-method': `${method.id}`,
			'content-type': this.contentTypeValue,
			accept: this.contentTypeValue,
			path: `/${method.service}/${method.name}`,
			'service-name': method.service,
		});
		if (options?.deadline) {
			headers.set('tempo-deadline', `${options.deadline.toUnixTimestamp()}`);
		}
		// we can't modify the useragent in browsers, so use x-user-agent instead
		if (ExecutionEnvironment.isBrowser || ExecutionEnvironment.isWebWorker) {
			headers.set('x-user-agent', this.userAgent);
		} else {
			headers.set('user-agent', this.userAgent);
		}
		// Add custom metadata to headers if available
		if (context.outgoingMetadata.size() > 0) {
			headers.set('custom-metadata', context.outgoingMetadata.toHttpHeader());
		}
		const requestInit: RequestInit = {
			method: 'POST',
			body: payload,
			headers: headers,
		};
		(requestInit as any).duplex = 'half';
		// Add AbortSignal if available
		if (options?.controller) {
			requestInit.signal = options.controller.signal;
		}
		const credentialHeader = await this.credential.getHeader();
		if (credentialHeader) {
			headers.set(credentialHeader.name, credentialHeader.value);
			requestInit.credentials = 'include';
			requestInit.cache = 'no-cache';
		}
		return requestInit;
	}

	/**
	 * Processes the headers of the response from the server, validating their integrity and correctness.
	 * Also sets the incoming metadata from the response headers to the provided context.
	 *
	 * @private
	 * @param {Response} response - The response received from the server.
	 * @param {ClientContext} context - The context of the client making the request.
	 * @param {MethodType} methodType - The type of method being called.
	 * @throws {TempoError} Throws an error if any validation checks fail or if there's a problem parsing or storing credentials.
	 */
	private async processResponseHeaders(response: Response, context: ClientContext, methodType: MethodType) {
		// Validate response headers
		const statusCodeString = response.headers.get('tempo-status');
		if (statusCodeString === null) {
			throw new TempoError(TempoStatusCode.UNKNOWN, 'tempo-status missing from response.');
		}

		const statusCode: TempoStatusCode = TempoUtil.tryParseInt(statusCodeString);
		if (statusCode !== TempoStatusCode.OK) {
			let tempoMessage = response.headers.get('tempo-message');
			if (!tempoMessage) {
				tempoMessage = 'unknown error';
			}
			throw new TempoError(statusCode, tempoMessage);
		}

		const responseContentType = response.headers.get('content-type');
		if (responseContentType === null) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'content-type missing on response');
		}
		const contentType = TempoUtil.parseContentType(responseContentType);
		if (contentType.format !== this.contentType) {
			throw new TempoError(
				TempoStatusCode.INVALID_ARGUMENT,
				`response content-type does not match request: ${contentType.format} !== ${this.contentType}`,
			);
		}
		if (methodType === MethodType.Unary || methodType === MethodType.ClientStream) {
			const contentLength = response.headers.get('content-length');
			if (contentLength === null) {
				throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'response did not contain a valid content-length header');
			}
			if (TempoUtil.tryParseInt(contentLength) > this.maxReceiveMessageSize) {
				throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'response exceeded max receive message size');
			}
		}
		// Set incoming metadata from response headers
		const customHeader = response.headers.get('custom-metadata');
		if (customHeader !== null) {
			context.incomingMetadata = Metadata.fromHttpHeader(customHeader);
		}
		const responseCredential = response.headers.get('tempo-credential');
		if (responseCredential !== null) {
			const credential = parseCredential(responseCredential);
			if (!credential) {
				throw new TempoError(
					TempoStatusCode.INVALID_ARGUMENT,
					"unable to parse credentials received on 'tempo-credential' header",
				);
			}
			await this.credential.storeCredential(credential);
		}
	}

	/**
	 * {@inheritDoc BaseChannel.startUnary}
	 */
	public override async startUnary<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		request: TRequest,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions | undefined,
	): Promise<TResponse> {
		try {
			// Prepare request data based on content type
			const requestData: Uint8Array = this.serializeRequest(request, method);
			if (this.hooks !== undefined) {
				await this.hooks.executeRequestHooks(context);
			}
			const requestInit = await this.createRequest(requestData, context, method, options);
			let response: Response;
			// If the retry policy is set, execute the request with retries
			if (options?.retryPolicy) {
				response = await this.executeWithRetry(
					async (retryAttempt: number) => {
						if (retryAttempt > 0) {
							context.outgoingMetadata.set('tempo-previous-rpc-attempts', String(retryAttempt));
							if (requestInit.headers instanceof Headers) {
								requestInit.headers.set('custom-metadata', context.outgoingMetadata.toHttpHeader());
							}
						}
						return await this.fetchData(requestInit);
					},
					options.retryPolicy,
					options.deadline,
					options.controller,
				);
				// If the deadline is set, execute the request within the deadline
			} else if (options?.deadline) {
				response = await options.deadline.executeWithinDeadline(async () => {
					return await this.fetchData(requestInit);
				}, options.controller);
			} else {
				// Otherwise, just execute the request indefinitely
				response = await this.fetchData(requestInit);
			}
			// Validate response headers
			await this.processResponseHeaders(response, context, method.type);
			if (this.hooks !== undefined) {
				await this.hooks.executeResponseHooks(context);
			}
			// Deserialize the response based on the content type
			const responseData = new Uint8Array(await response.arrayBuffer());
			const record: TResponse = this.deserializeResponse(responseData, method);
			if (this.hooks !== undefined) {
				await this.hooks.executeDecodeHooks(context, record);
			}
			// Return the deserialized response object
			return record;
		} catch (e) {
			if (this.hooks !== undefined && e instanceof Error) {
				this.hooks.executeErrorHooks(context, e);
			}
			if (e instanceof TempoError) {
				throw e;
			}
			if (e instanceof Error) {
				if (e.name === 'AbortError') {
					throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
				} else {
					throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', e);
				}
			}
			throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', { data: e });
		}
	}

	/**
	 * {@inheritDoc BaseChannel.startClientStream}
	 */
	public override async startClientStream<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		generator: () => AsyncGenerator<TRequest, void, undefined>,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions | undefined,
	): Promise<TResponse> {
		try {
			if (!supportsRequestStreams) {
				throw new TempoError(TempoStatusCode.UNIMPLEMENTED, 'request streams are not supported in this environment');
			}
			const transformStream = new TransformStream<Uint8Array, Uint8Array>();
			tempoStream.writeTempoStream(
				transformStream.writable,
				generator(),
				(payload: TRequest) => this.serializeRequest(payload, method),
				options?.deadline,
				options?.controller,
			);
			if (this.hooks !== undefined) {
				await this.hooks.executeRequestHooks(context);
			}
			const requestInit = await this.createRequest(transformStream.readable, context, method, options);
			let response: Response;
			if (options?.deadline) {
				response = await options.deadline.executeWithinDeadline(async () => {
					return await this.fetchData(requestInit);
				}, options.controller);
			} else {
				// Otherwise, just execute the request indefinitely
				response = await this.fetchData(requestInit);
			}
			// Validate response headers
			await this.processResponseHeaders(response, context, method.type);
			// Deserialize the response based on the content type
			const responseData = new Uint8Array(await response.arrayBuffer());
			const record: TResponse = this.deserializeResponse(responseData, method);
			if (this.hooks !== undefined) {
				await this.hooks.executeDecodeHooks(context, record);
			}
			// Return the deserialized response object
			return record;
		} catch (e) {
			if (this.hooks !== undefined && e instanceof Error) {
				this.hooks.executeErrorHooks(context, e);
			}
			if (e instanceof TempoError) {
				throw e;
			}
			if (e instanceof Error) {
				if (e.name === 'AbortError') {
					throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
				} else {
					throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', e);
				}
			}
			throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', { data: e });
		}
	}
	/**
	 * {@inheritDoc BaseChannel.startServerStream}
	 */
	public override async startServerStream<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		request: TRequest,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions | undefined,
	): Promise<AsyncGenerator<TResponse, void, undefined>> {
		try {
			// Prepare request data based on content type
			const requestData: Uint8Array = this.serializeRequest(request, method);
			if (this.hooks !== undefined) {
				await this.hooks.executeRequestHooks(context);
			}
			const requestInit = await this.createRequest(requestData, context, method, options);

			let response: Response;
			// If the retry policy is set, execute the request with retries
			if (options?.retryPolicy) {
				response = await this.executeWithRetry(
					async (retryAttempt: number) => {
						if (retryAttempt > 0) {
							context.outgoingMetadata.set('tempo-previous-rpc-attempts', String(retryAttempt));
							if (requestInit.headers instanceof Headers) {
								requestInit.headers.set('custom-metadata', context.outgoingMetadata.toHttpHeader());
							}
						}
						return await this.fetchData(requestInit);
					},
					options.retryPolicy,
					options.deadline,
					options.controller,
				);
				// If the deadline is set, execute the request within the deadline
			} else if (options?.deadline) {
				response = await options.deadline.executeWithinDeadline(async () => {
					return await this.fetchData(requestInit);
				}, options.controller);
			} else {
				// Otherwise, just execute the request indefinitely
				response = await this.fetchData(requestInit);
			}

			// Validate response headers
			await this.processResponseHeaders(response, context, method.type);
			if (response.body === null) {
				throw new TempoError(TempoStatusCode.INTERNAL, 'response body is null');
			}
			const body = response.body;
			return tempoStream.readTempoStream(
				body,
				async (buffer: Uint8Array) => {
					if (buffer.length > this.maxReceiveMessageSize) {
						throw new TempoError(
							TempoStatusCode.RESOURCE_EXHAUSTED,
							`received message larger than ${this.maxReceiveMessageSize} bytes`,
						);
					}
					const record = this.deserializeResponse(buffer, method);
					if (this.hooks !== undefined) {
						await this.hooks.executeDecodeHooks(context, record);
					}
					return record;
				},
				options?.deadline,
				options?.controller,
			);
		} catch (e) {
			if (this.hooks !== undefined && e instanceof Error) {
				this.hooks.executeErrorHooks(context, e);
			}
			if (e instanceof TempoError) {
				throw e;
			}
			if (e instanceof Error) {
				if (e.name === 'AbortError') {
					throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
				} else {
					throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', e);
				}
			}
			throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', { data: e });
		}
	}
	/**
	 * {@inheritDoc BaseChannel.startDuplexStream}
	 */
	public override async startDuplexStream<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		generator: () => AsyncGenerator<TRequest, void, undefined>,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions | undefined,
	): Promise<AsyncGenerator<TResponse, void, undefined>> {
		try {
			if (!supportsRequestStreams) {
				throw new TempoError(TempoStatusCode.UNIMPLEMENTED, 'request streams are not supported in this environment');
			}
			const transformStream = new TransformStream<Uint8Array, Uint8Array>();
			tempoStream.writeTempoStream(
				transformStream.writable,
				generator(),
				(payload: TRequest) => this.serializeRequest(payload, method),
				options?.deadline,
				options?.controller,
			);
			if (this.hooks !== undefined) {
				await this.hooks.executeRequestHooks(context);
			}
			const requestInit = await this.createRequest(transformStream.readable, context, method, options);
			let response: Response;
			if (options?.deadline) {
				response = await options.deadline.executeWithinDeadline(async () => {
					return await this.fetchData(requestInit);
				}, options.controller);
			} else {
				// Otherwise, just execute the request indefinitely
				response = await this.fetchData(requestInit);
			}
			// Validate response headers
			await this.processResponseHeaders(response, context, method.type);
			if (response.body === null) {
				throw new TempoError(TempoStatusCode.INTERNAL, 'response body is null');
			}
			const body = response.body;
			return tempoStream.readTempoStream(
				body,
				async (buffer: Uint8Array) => {
					if (buffer.length > this.maxReceiveMessageSize) {
						throw new TempoError(
							TempoStatusCode.RESOURCE_EXHAUSTED,
							`received message larger than ${this.maxReceiveMessageSize} bytes`,
						);
					}
					const record = this.deserializeResponse(buffer, method);
					if (this.hooks !== undefined) {
						await this.hooks.executeDecodeHooks(context, record);
					}
					return record;
				},
				options?.deadline,
				options?.controller,
			);
		} catch (e) {
			if (this.hooks !== undefined && e instanceof Error) {
				this.hooks.executeErrorHooks(context, e);
			}
			if (e instanceof TempoError) {
				throw e;
			}
			if (e instanceof Error) {
				if (e.name === 'AbortError') {
					throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
				} else {
					throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', e);
				}
			}
			throw new TempoError(TempoStatusCode.UNKNOWN, 'an unknown error occurred', { data: e });
		}
	}
}
