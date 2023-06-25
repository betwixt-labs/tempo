import {
	Metadata,
	TempoLogger,
	TempoError,
	TempoStatusCode,
	TempoUtil,
	stringifyCredential,
	Deadline,
	MethodType,
	tempoStream,
	TempoVersion,
	BebopContentType,
} from '@tempojs/common';
import {
	BaseRouter,
	ServerContext,
	ServiceRegistry,
	AuthInterceptor,
	IncomingContext,
	TempoRouterConfiguration,
	BebopMethodAny,
} from '@tempojs/server';
import { BebopRecord } from 'bebop';

export class TempoRouter<TEnv> extends BaseRouter<Request, TEnv, Response> {
	private readonly poweredByString: string;
	constructor(
		logger: TempoLogger,
		registry: ServiceRegistry,
		configuration: TempoRouterConfiguration = new TempoRouterConfiguration(),
		authInterceptor?: AuthInterceptor,
	) {
		super(logger, registry, configuration, authInterceptor);
		this.definePoweredByHeader('cloudflare-workers');
		this.poweredByString = JSON.stringify({
			tempo: TempoVersion,
			language: 'javascript',
			runtime: TempoUtil.getEnvironmentName(),
			variant: 'cloudflare-workers',
		});
	}

	/**
	 * Private function that clones headers to avoid any side effects.
	 *
	 * @private
	 * @function
	 * @param {Headers} headers The headers object from the request.
	 * @returns {Headers} The cloned headers object.
	 */
	private cloneHeaders(headers: Headers): Headers {
		const clonedHeaders = new Headers();
		headers.forEach((v, k) => {
			if (clonedHeaders.has(k)) {
				clonedHeaders.append(k, v);
			} else {
				clonedHeaders.set(k, v);
			}
		});
		return clonedHeaders;
	}

	private handleOptions(request: Request): Response {
		const origin = request.headers.get('origin');
		const preFlightRequestHeaders = request.headers.get('access-control-request-headers');
		if (
			origin !== null &&
			request.headers.get('access-control-request-method') !== null &&
			preFlightRequestHeaders !== null
		) {
			// Handle CORS pre-flight request.
			this.logger.trace('Handling CORS pre-flight request');
			const headers: HeadersInit = {
				'access-control-allow-methods': 'POST, OPTIONS',
				'access-control-allow-headers': preFlightRequestHeaders,
				'access-control-allow-credentials': 'true',
			};
			if (this.allowedCorsOrigins !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new TempoError(TempoStatusCode.PERMISSION_DENIED, 'Origin not allowed');
				}
				headers['access-control-allow-origin'] = origin;
				headers['vary'] = 'origin';
				this.logger.trace(`Allowing CORS for origin ${origin}`);
			} else {
				headers['access-control-allow-origin'] = '*';
			}
			return new Response(null, {
				status: 204,
				headers: headers,
			});
		} else {
			// Handle standard OPTIONS request.
			return new Response(null, {
				headers: {
					Allow: 'POST, OPTIONS',
				},
			});
		}
	}

	private setCorsHeaders(headers: Headers, origin: string): void {
		if (this.corsEnabled) {
			if (this.allowedCorsOrigins !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new TempoError(TempoStatusCode.PERMISSION_DENIED, 'origin not allowed');
				}
				headers.set('access-control-allow-origin', origin);
				headers.append('vary', 'origin');
				headers.set('access-control-allow-credentials', 'true');
			} else {
				headers.set('access-control-allow-origin', '*');
			}
		}
		headers.set(
			'access-control-expose-headers',
			'content-encoding, content-length, content-type, tempo-status, tempo-message, custom-metadata, tempo-credential',
		);
	}

	private async setAuthContext(request: Request, context: ServerContext): Promise<void> {
		const authHeader = request.headers.get('authorization');
		if (authHeader !== null && this.authInterceptor !== undefined) {
			const authContext = await this.authInterceptor.intercept(context, authHeader);
			context.authContext = authContext;
		}
	}

	private async invokeUnaryMethod(
		request: Request,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<BebopRecord> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		const requestData = new Uint8Array(await request.arrayBuffer());
		if (requestData.length > this.maxReceiveMessageSize) {
			throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
		}
		const record = this.deserializeRequest(requestData, method, contentType);
		if (this.hooks !== undefined) {
			await this.hooks.executeDecodeHooks(context, record);
		}
		return await method.invoke(record, context);
	}

	private async invokeClientStreamMethod(
		request: Request,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<BebopRecord> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		const body = request.body;
		if (body === null) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'invalid request: missing body');
		}
		const generator = () => {
			return tempoStream.readTempoStream(
				body,
				async (data: Uint8Array) => {
					if (data.length > this.maxReceiveMessageSize) {
						throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
					}
					const record = this.deserializeRequest(data, method, contentType);
					if (this.hooks !== undefined) {
						await this.hooks.executeDecodeHooks(context, record);
					}
					return record;
				},
				context.clientDeadline,
			);
		};
		return await method.invoke(generator, context);
	}

	private async invokeServerStreamMethod(
		request: Request,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<AsyncGenerator<BebopRecord, void, unknown>> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		const requestData = new Uint8Array(await request.arrayBuffer());
		if (requestData.length > this.maxReceiveMessageSize) {
			throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
		}
		const record = this.deserializeRequest(requestData, method, contentType);
		if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: method must be async generator');
		}
		if (this.hooks !== undefined) {
			await this.hooks.executeDecodeHooks(context, record);
		}
		return method.invoke(record, context);
	}

	private async invokeDuplexStreamMethod(
		request: Request,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<AsyncGenerator<BebopRecord, void, unknown>> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		const body = request.body;
		if (body === null) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'invalid request: missing body');
		}
		const generator = () => {
			return tempoStream.readTempoStream(
				body,
				async (data: Uint8Array) => {
					if (data.length > this.maxReceiveMessageSize) {
						throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
					}
					const record = this.deserializeRequest(data, method, contentType);
					if (this.hooks !== undefined) {
						await this.hooks.executeDecodeHooks(context, record);
					}
					return record;
				},
				context.clientDeadline,
			);
		};
		if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: method must be async generator');
		}
		return method.invoke(generator, context);
	}

	private handlePoweredBy(request: Request): Response {
		const responseHeaders = new Headers();
		const origin = request.headers.get('origin');
		if (origin !== null) {
			this.setCorsHeaders(responseHeaders, origin);
		}
		responseHeaders.set('content-type', 'application/json');
		responseHeaders.set('cache-control', 'max-age=31536000');
		return new Response(this.poweredByString, {
			status: 200,
			headers: responseHeaders,
		});
	}

	/**
	 * Public function that handles Tempo requests by parsing and validating the request, invoking the appropriate method
	 * with the appropriate context and sending a response back.
	 *
	 * @function
	 * @async
	 * @throws {Error} When the HTTP method is not POST or when the requested method does not exist.
	 * @param {Request} request The request object from the BRPC request.
	 * @param {TEnv} env The environment object for the Tempo request.
	 * @returns {Response} The response object for the Tempo request.
	 */
	override async handle(request: Request, env: TEnv): Promise<Response> {
		if (this.corsEnabled && request.method === 'OPTIONS') {
			return this.handleOptions(request);
		}
		if (this.exposeTempo && request.method === 'GET') {
			return this.handlePoweredBy(request);
		}
		const origin = request.headers.get('origin');
		try {
			if (request.method !== 'POST') {
				throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'Tempo request must be "POST"');
			}
			if (!request.headers.has('tempo-method')) {
				throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'header "tempo-method" is missing.');
			}
			const contentTypeHeader = request.headers.get('content-type');
			if (contentTypeHeader === null) {
				throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'header "content-type" is missing.');
			}
			// we do nothing with the charset for now, so we can just ignore it.
			const contentType = TempoUtil.parseContentType(contentTypeHeader);
			const methodId = Number(request.headers.get('tempo-method'));
			const method = this.registry.getMethod(methodId);
			if (!method) {
				throw new TempoError(
					TempoStatusCode.FAILED_PRECONDITION,
					`no service is registered which contains a method of '${methodId}'`,
				);
			}
			const metadata = this.getCustomMetaData(request.headers.get('custom-metadata'));
			const previousAttempts = metadata.getTextValues('tempo-previous-rpc-attempts');
			if (previousAttempts !== undefined && previousAttempts[0] !== undefined) {
				const numberOfAttempts = TempoUtil.tryParseInt(previousAttempts[0]);
				if (numberOfAttempts > this.maxRetryAttempts) {
					throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'max retry attempts exceeded');
				}
			}

			let deadline: Deadline | undefined;
			const deadlineHeader = request.headers.get('tempo-deadline');
			if (deadlineHeader !== null) {
				deadline = Deadline.fromUnixTimestamp(TempoUtil.tryParseInt(deadlineHeader));
			}
			if (deadline !== undefined && deadline.isExpired()) {
				throw new TempoError(TempoStatusCode.DEADLINE_EXCEEDED, 'incoming request has already exceeded its deadline');
			}
			const outgoingMetadata = new Metadata();
			const incomingContext: IncomingContext = {
				headers: this.cloneHeaders(request.headers),
				metadata: metadata,
			};
			if (deadline !== undefined) {
				incomingContext.deadline = deadline;
			}

			const context = new ServerContext(
				incomingContext,
				{
					metadata: outgoingMetadata,
				},
				env,
			);
			const handleRequest = async () => {
				let recordGenerator: AsyncGenerator<BebopRecord, void, undefined> | undefined = undefined;
				let record: BebopRecord | undefined;
				switch (method.type) {
					case MethodType.Unary:
						record = await this.invokeUnaryMethod(request, context, method, contentType.format);
						break;
					case MethodType.ClientStream:
						record = await this.invokeClientStreamMethod(request, context, method, contentType.format);
						break;
					case MethodType.ServerStream:
						recordGenerator = await this.invokeServerStreamMethod(request, context, method, contentType.format);
						break;
					case MethodType.DuplexStream:
						recordGenerator = await this.invokeDuplexStreamMethod(request, context, method, contentType.format);
						break;
					default:
						throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: unknown method type');
				}
				const responseHeaders = new Headers();
				if (this.exposeTempo && this.poweredByHeaderValue !== undefined) {
					responseHeaders.set(this.poweredByHeader, this.poweredByHeaderValue);
				}
				if (origin !== null) {
					this.setCorsHeaders(responseHeaders, origin);
				}
				responseHeaders.set('content-type', contentType.raw);

				const outgoingCredential = context.outgoingCredential;
				if (outgoingCredential) {
					responseHeaders.set('tempo-credential', stringifyCredential(outgoingCredential));
				}
				responseHeaders.set('tempo-status', '0');
				responseHeaders.set('tempo-message', 'OK');
				if (this.hooks !== undefined) {
					await this.hooks.executeResponseHooks(context);
				}
				// freeze metadata after response hooks are ran
				outgoingMetadata.freeze();
				if (outgoingMetadata.size() > 0) {
					responseHeaders.set('custom-metadata', outgoingMetadata.toHttpHeader());
				}
				let responseData: ReadableStream<Uint8Array> | Uint8Array;

				if (recordGenerator !== undefined) {
					const transformStream = new TransformStream<Uint8Array, Uint8Array>();
					responseData = transformStream.readable;
					tempoStream.writeTempoStream(
						transformStream.writable,
						recordGenerator,
						(payload: BebopRecord) => {
							const data = this.serializeResponse(payload, method, contentType.format);
							if (this.maxSendMessageSize !== undefined && data.length > this.maxSendMessageSize) {
								throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'response too large');
							}
							return data;
						},
						context.clientDeadline,
					);
				} else {
					if (record === undefined) {
						throw new TempoError(TempoStatusCode.INTERNAL, 'service method did not return a record');
					}
					responseData = this.serializeResponse(record, method, contentType.format);
					if (this.maxSendMessageSize !== undefined && responseData.length > this.maxSendMessageSize) {
						throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'response too large');
					}
					if (method.type === MethodType.Unary || method.type === MethodType.ClientStream) {
						responseHeaders.set('content-length', String(responseData.length));
					}
				}
				return new Response(responseData, {
					status: 200,
					headers: responseHeaders,
				});
			};
			return deadline !== undefined ? await deadline.executeWithinDeadline(handleRequest) : await handleRequest();
		} catch (e) {
			let status = TempoStatusCode.UNKNOWN;
			let message = 'unknown error';
			if (e instanceof TempoError) {
				status = e.status;
				message = e.message;
				// dont expose internal error messages to the client
				if (e.status === TempoStatusCode.INTERNAL && this.transmitInternalErrors === false) {
					message = 'internal error';
				}
				// internal errors indicate transient problems or implementation bugs
				// so we log them as critical errors
				e.status === TempoStatusCode.INTERNAL
					? this.logger.critical(e.message, undefined, e)
					: this.logger.error(message, undefined, e);
			} else if (e instanceof Error) {
				if (e.message.includes('D1_') && this.transmitInternalErrors === false) {
					message = 'internal error';
					status = TempoStatusCode.INTERNAL;
					this.logger.critical(e.message, undefined, e);
				} else {
					message = e.message;
					this.logger.error(message, undefined, e);
				}
			}
			if (e instanceof Error && this.hooks !== undefined) {
				await this.hooks.executeErrorHooks(undefined, e);
			}
			const responseHeaders = new Headers();
			if (this.exposeTempo && this.poweredByHeaderValue !== undefined) {
				responseHeaders.set(this.poweredByHeader, this.poweredByHeaderValue);
			}
			responseHeaders.set('tempo-status', `${status}`);
			responseHeaders.set('tempo-message', message);
			if (origin !== null) {
				this.setCorsHeaders(responseHeaders, origin);
			}
			return new Response(undefined, {
				status: TempoError.codeToHttpStatus(status),
				headers: responseHeaders,
			});
		}
	}

	override process(_request: Request<unknown, CfProperties<unknown>>, _response: Response, _env: TEnv): Promise<void> {
		throw new TempoError(TempoStatusCode.UNIMPLEMENTED, 'Method not implemented.');
	}
}
