import {
	BebopContentType,
	Deadline,
	Metadata,
	MethodType,
	TempoError,
	TempoLogger,
	TempoStatusCode,
	TempoUtil,
	TempoVersion,
	stringifyCredential,
} from '@tempojs/common';
import {
	AuthInterceptor,
	BaseRouter,
	ServiceRegistry,
	TempoRouterConfiguration,
	IncomingContext,
	ServerContext,
	BebopMethodAny,
} from '@tempojs/server';
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';
import { FetchHeadersAdapter } from './header';
import { readTempoStream, writeTempoStream } from './helpers';
import { BebopRecord } from 'bebop';

export class TempoRouter<TEnv> extends BaseRouter<IncomingMessage, TEnv, ServerResponse> {
	private readonly poweredByString: string;
	constructor(
		logger: TempoLogger,
		registry: ServiceRegistry,
		configuration: TempoRouterConfiguration = new TempoRouterConfiguration(),
		authInterceptor?: AuthInterceptor,
	) {
		super(logger, registry, configuration, authInterceptor);
		this.definePoweredByHeader('node-http');
		this.poweredByString = JSON.stringify({
			tempo: TempoVersion,
			language: 'javascript',
			runtime: TempoUtil.getEnvironmentName(),
			variant: 'node-http',
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
	private cloneHeaders(headers: IncomingHttpHeaders): FetchHeadersAdapter {
		return new FetchHeadersAdapter(headers);
	}

	private setCorsHeaders(response: ServerResponse, origin: string): void {
		if (this.corsEnabled) {
			if (this.allowedCorsOrigins !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new TempoError(TempoStatusCode.PERMISSION_DENIED, 'origin not allowed');
				}
				response.setHeader('access-control-allow-origin', origin);
				response.setHeader('vary', 'origin');
				response.setHeader('access-control-allow-credentials', 'true');
			} else {
				response.setHeader('access-control-allow-origin', '*');
			}
		}
		response.setHeader(
			'access-control-expose-headers',
			'content-encoding, content-length, content-type, tempo-status, tempo-message, custom-metadata, tempo-credential',
		);
	}

	private prepareOptionsResponse(request: IncomingMessage, response: ServerResponse): number {
		const origin = request.headers.origin;
		const preFlightRequestHeaders = request.headers['access-control-request-headers'];
		if (
			origin !== undefined &&
			request.headers['access-control-request-method'] !== undefined &&
			preFlightRequestHeaders !== undefined
		) {
			// Handle CORS pre-flight request.
			this.logger.trace('Handling CORS pre-flight request');
			response.setHeader('access-control-allow-methods', 'POST, OPTIONS');
			response.setHeader('access-control-allow-headers', preFlightRequestHeaders);
			response.setHeader('access-control-allow-credentials', 'true');
			if (this.allowedCorsOrigins !== undefined && origin !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new TempoError(TempoStatusCode.PERMISSION_DENIED, 'Origin not allowed');
				}
				response.setHeader('access-control-allow-origin', origin);
				response.setHeader('vary', 'origin');
				this.logger.trace(`Allowing CORS for origin ${origin}`);
			} else {
				response.setHeader('access-control-allow-origin', '*');
			}
			return 204; // 204 No Content is the standard status for successful pre-flight requests
		} else {
			// Handle standard OPTIONS request.
			return 200; // 200 OK for standard OPTIONS request
		}
	}

	private async setAuthContext(request: IncomingMessage, context: ServerContext): Promise<void> {
		const authHeader = request.headers.authorization;
		if (authHeader !== undefined && this.authInterceptor !== undefined) {
			const authContext = await this.authInterceptor.intercept(context, authHeader);
			context.authContext = authContext;
		}
	}

	private async invokeUnaryMethod(
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<BebopRecord> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		const requestData = new Uint8Array(
			await new Promise<Buffer>((resolve, reject) => {
				const chunks: Buffer[] = [];
				request.on('data', (chunk: Buffer) => chunks.push(chunk));
				request.on('end', () => resolve(Buffer.concat(chunks)));
				request.on('error', (err) => reject(err));
			}),
		);
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
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<BebopRecord> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		if (!request.readable) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'invalid request: not readable');
		}
		const generator = () => {
			return readTempoStream(
				request,
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
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<AsyncGenerator<BebopRecord, void, unknown>> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		const requestData = new Uint8Array(
			await new Promise<Buffer>((resolve, reject) => {
				const chunks: Buffer[] = [];
				request.on('data', (chunk: Buffer) => chunks.push(chunk));
				request.on('end', () => resolve(Buffer.concat(chunks)));
				request.on('error', (err) => reject(err));
			}),
		);
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
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
		contentType: BebopContentType,
	): Promise<AsyncGenerator<BebopRecord, void, unknown>> {
		await this.setAuthContext(request, context);
		if (this.hooks !== undefined) {
			await this.hooks.executeRequestHooks(context);
		}
		if (!request.readable) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'invalid request: not readable');
		}
		const generator = () => {
			return readTempoStream(
				request,
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

	private handlePoweredBy(request: IncomingMessage, response: ServerResponse): void {
		const origin = request.headers.origin;
		if (origin !== undefined) {
			this.setCorsHeaders(response, origin);
		}
		response.setHeader('content-type', 'application/json');
		response.setHeader('cache-control', 'max-age=31536000');
	}

	public override async process(request: IncomingMessage, response: ServerResponse, env: TEnv) {
		// Check if the request is an OPTIONS request
		if (request.method === 'OPTIONS') {
			response.writeHead(this.prepareOptionsResponse(request, response));
			response.end();
			return;
		}
		if (this.exposeTempo && request.method === 'GET') {
			this.handlePoweredBy(request, response);
			response.writeHead(200);
			response.end(this.poweredByString);
			return;
		}
		const origin = request.headers.origin;
		try {
			if (request.method !== 'POST') {
				throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'Tempo request must be "POST"');
			}
			if (!request.headers['tempo-method']) {
				throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'header "tempo-method" is missing.');
			}
			const contentTypeHeader = request.headers['content-type'];
			if (contentTypeHeader === undefined) {
				throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'header "content-type" is missing.');
			}
			const contentType = TempoUtil.parseContentType(contentTypeHeader);
			const methodId = Number(request.headers['tempo-method']);
			const method = this.registry.getMethod(methodId);
			if (!method) {
				throw new TempoError(
					TempoStatusCode.NOT_FOUND,
					`no service is registered which contains a method of '${methodId}'`,
				);
			}
			const metadataHeader = request.headers['custom-metadata'];
			const metadata =
				metadataHeader && typeof metadataHeader === 'string' ? this.getCustomMetaData(metadataHeader) : new Metadata();

			const previousAttempts = metadata.getTextValues('tempo-previous-rpc-attempts');
			if (previousAttempts !== undefined && previousAttempts[0] !== undefined) {
				const numberOfAttempts = TempoUtil.tryParseInt(previousAttempts[0]);
				if (numberOfAttempts > this.maxRetryAttempts) {
					throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'max retry attempts exceeded');
				}
			}

			let deadline: Deadline | undefined;
			const deadlineHeader = request.headers['tempo-deadline'];
			if (deadlineHeader !== undefined && typeof deadlineHeader === 'string') {
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
				// it is now safe to begin work on the response
				if (origin !== undefined) {
					this.setCorsHeaders(response, origin);
				}
				if (this.exposeTempo && this.poweredByHeaderValue !== undefined) {
					response.setHeader(this.poweredByHeader, this.poweredByHeaderValue);
				}
				response.setHeader('content-type', contentType.raw);

				const outgoingCredential = context.outgoingCredential;
				if (outgoingCredential) {
					response.setHeader('tempo-credential', stringifyCredential(outgoingCredential));
				}
				response.setHeader('tempo-status', '0');
				response.setHeader('tempo-message', 'OK');
				if (this.hooks !== undefined) {
					await this.hooks.executeResponseHooks(context);
				}
				outgoingMetadata.freeze();
				if (outgoingMetadata.size() > 0) {
					response.setHeader('custom-metadata', outgoingMetadata.toHttpHeader());
				}
				if (recordGenerator !== undefined) {
					response.writeHead(200);
					writeTempoStream(
						response,
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
					const responseData = this.serializeResponse(record, method, contentType.format);
					if (method.type === MethodType.Unary || method.type === MethodType.ClientStream) {
						response.setHeader('content-length', String(responseData.length));
					}
					response.writeHead(200);
					response.end(responseData);
				}
			};
			deadline !== undefined ? await deadline.executeWithinDeadline(handleRequest) : await handleRequest();
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
					? this.logger.critical(message, undefined, e)
					: this.logger.error(message, undefined, e);
			} else if (e instanceof Error) {
				message = e.message;
				this.logger.error(message, undefined, e);
			}
			if (e instanceof Error && this.hooks !== undefined) {
				await this.hooks.executeErrorHooks(undefined, e);
			}
			if (this.exposeTempo && this.poweredByHeaderValue !== undefined) {
				response.setHeader(this.poweredByHeader, this.poweredByHeaderValue);
			}
			response.setHeader('tempo-status', `${status}`);
			response.setHeader('tempo-message', message);
			if (origin !== undefined) {
				this.setCorsHeaders(response, origin);
			}
			response.writeHead(TempoError.codeToHttpStatus(status));
			response.end();
		}
	}

	override handle(_request: IncomingMessage, _env: TEnv): Promise<ServerResponse> {
		throw new TempoError(TempoStatusCode.UNIMPLEMENTED, 'Method not implemented.');
	}
}
