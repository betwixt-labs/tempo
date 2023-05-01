import {
	TempoLogger,
	TempoError,
	TempoStatusCode,
	ConsoleLogger,
	Deadline,
	Metadata,
	TempoContentType,
	parseCredentials,
	ExecutionEnvironment,
	TempoVersion,
	Credentials,
} from '@tempojs/common';
import { TempoChannelOptions, CallOptions } from './options';
import { BebopRecord } from 'bebop';
import { BaseClient, ClientConstructor } from './client';
import { ClientContext } from './context';
import { MethodInfo } from './method';
import { RetryPolicy } from './retry';
import { TempoUtil } from '@tempojs/common';
import { CallCredentials, InsecureChannelCredentials } from './auth';

/**
 * The BaseChannel class represents the foundation for implementing specific
 * communication channels for Tempo.
 */
export abstract class BaseChannel {
	/**
	 * Constructs a BaseChannel instance.
	 * @param {URL} target - The target URL of the server.
	 */
	protected constructor(protected readonly target: URL) {}

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
	 * Sends a request to a server and returns the response.
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
	public abstract send<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		request: TRequest,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions,
	): Promise<TResponse>;

	public abstract removeCredentials(): Promise<void>;
	public abstract getCredentials(): Promise<Credentials | undefined>;
}

/**
 * Represents a Tempo channel for communication with a remote server.
 */
export class TempoChannel extends BaseChannel {
	public static readonly defaultContentType: TempoContentType = 'bebop';
	public static readonly defaultMaxRetryAttempts: number = 5;
	public static readonly defaultMaxReceiveMessageSize: number = 1024 * 1024 * 4; // 4 MB
	public static readonly defaultCredentials: CallCredentials = InsecureChannelCredentials.create();

	private readonly logger: TempoLogger;
	private readonly contentType: TempoContentType;
	private readonly isSecure: boolean;
	private readonly maxReceiveMessageSize: number;
	private readonly credentials: CallCredentials;
	private readonly userAgent: string;

	/**
	 * Constructs a new TempoChannel instance.
	 *
	 * @param {URL} target - The target URL for the channel.
	 * @param {TempoChannelOptions} options - The configuration options for the channel.
	 * @protected
	 */
	protected constructor(target: URL, options: TempoChannelOptions) {
		super(target);
		this.logger = options.logger ??= new ConsoleLogger('TempoChannel');
		this.logger.debug('creating new TempoChannel');
		this.contentType = options.contentType ??= TempoChannel.defaultContentType;
		this.isSecure = target.protocol === 'https:';
		this.credentials = options.credentials ??= TempoChannel.defaultCredentials;
		if (
			!this.isSecure &&
			!(this.credentials instanceof InsecureChannelCredentials) &&
			options.unsafeUseInsecureChannelCallCredentials !== true
		) {
			throw new Error('Cannot use secure credentials with insecure channel');
		}
		this.maxReceiveMessageSize = options.maxReceiveMessageSize ??= TempoChannel.defaultMaxReceiveMessageSize;
		this.credentials = options.credentials ??= TempoChannel.defaultCredentials;
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

	public override async removeCredentials(): Promise<void> {
		await this.credentials.removeCredentials();
	}
	public override async getCredentials(): Promise<Credentials | undefined> {
		return await this.credentials.getCredentials();
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
				console.log(`attempt ${attempt}`);
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
	 * {@inheritDoc BaseChannel.send}
	 */
	async send<TRequest extends BebopRecord, TResponse extends BebopRecord>(
		request: TRequest,
		context: ClientContext,
		method: MethodInfo<TRequest, TResponse>,
		options?: CallOptions,
	): Promise<TResponse> {
		try {
			// Prepare request data based on content type
			const requestData: Uint8Array =
				this.contentType === 'json' ? TempoUtil.textEncoder.encode(JSON.stringify(request)) : method.serialize(request);
			const contentTypeValue = `application/tempo+${this.contentType}`;

			// Set up request headers
			const headers = new Headers({
				'tempo-method': `${method.id}`,
				'content-type': contentTypeValue,
				accept: contentTypeValue,
				path: `/${method.service}/${method.name}`,
				'service-name': method.service,
			});
			if (options?.deadline) {
				headers.set('tempo-deadline', `${options.deadline.toUnixTimestamp()}`);
			}
			// we can't modify the useragent in browsers, so use x-user-agent instead
			if (ExecutionEnvironment.isBrowser || ExecutionEnvironment.isWebWorker) {
				headers.set('X-User-Agent', this.userAgent);
			} else {
				headers.set('user-agent', this.userAgent);
			}

			// Add custom metadata to headers if available
			if (context.outgoingMetadata.size() > 0) {
				headers.set('custom-metadata', context.outgoingMetadata.toHttpHeader());
			}

			// Prepare request options
			const requestInit: RequestInit = {
				method: 'POST',
				body: requestData,
				headers: headers,
			};
			const credentialHeader = await this.credentials.getHeader();
			if (credentialHeader) {
				headers.set(credentialHeader.name, credentialHeader.value);
				requestInit.credentials = 'include';
				requestInit.cache = 'no-cache';
			}

			// Add AbortSignal if available
			if (options?.controller) {
				requestInit.signal = options.controller.signal;
			}

			let response: Response;

			// If the retry policy is set, execute the request with retries
			if (options?.retryPolicy) {
				response = await this.executeWithRetry(
					async (retryAttempt: number) => {
						if (retryAttempt > 0) {
							context.outgoingMetadata.set('tempo-previous-rpc-attempts', String(retryAttempt));
							headers.set('custom-metadata', context.outgoingMetadata.toHttpHeader());
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

			const responseContentType = response.headers.get('Content-type');
			if (responseContentType === null) {
				throw new TempoError(TempoStatusCode.UNKNOWN, 'content-type missing on response');
			}
			if (responseContentType !== contentTypeValue) {
				throw new TempoError(TempoStatusCode.UNKNOWN, 'response content-type does not match request');
			}

			const contentLength = response.headers.get('Content-length');
			if (contentLength === null) {
				throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'response did not contain a valid content-length header');
			}
			if (TempoUtil.tryParseInt(contentLength) > this.maxReceiveMessageSize) {
				throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'response exceeded max receive message size');
			}

			// Deserialize the response based on the content type
			const responseData = new Uint8Array(await response.arrayBuffer());
			const responseBody: TResponse =
				this.contentType === 'json'
					? JSON.parse(TempoUtil.textDecoder.decode(responseData))
					: method.deserialize(responseData);

			// Set incoming metadata from response headers
			const customHeader = response.headers.get('custom-metadata');
			if (customHeader !== null) {
				context.incomingMetadata = Metadata.fromHttpHeader(customHeader);
			}
			const responseCredentials = response.headers.get('tempo-credentials');
			if (responseCredentials !== null) {
				const credentials = parseCredentials(responseCredentials);
				if (!credentials) {
					throw new TempoError(
						TempoStatusCode.INVALID_ARGUMENT,
						"unable to parse credentials received on 'tempo-credentials' header",
					);
				}
				this.credentials.storeCredentials(credentials);
			}

			// Return the deserialized response object
			return responseBody;
		} catch (e) {
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
