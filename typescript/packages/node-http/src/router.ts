import {
	Deadline,
	Metadata,
	MethodType,
	TempoError,
	TempoLogger,
	TempoStatusCode,
	TempoUtil,
	stringifyCredentials,
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
import { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'http';
import { FetchHeadersAdapter } from './header';
import { readTempoStream, writeTempoStream } from './helpers';

export class TempoRouter<TEnv> extends BaseRouter<IncomingMessage, TEnv, ServerResponse> {
	constructor(
		logger: TempoLogger,
		registry: ServiceRegistry,
		configuration: TempoRouterConfiguration = new TempoRouterConfiguration(),
		authInterceptor?: AuthInterceptor,
	) {
		super(logger, registry, configuration, authInterceptor);
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

	private setCorsHeaders(headers: OutgoingHttpHeaders, origin: string): void {
		if (this.corsEnabled) {
			if (this.allowedCorsOrigins !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'origin not allowed');
				}
				headers['Access-Control-Allow-Origin'] = origin;
				headers['Vary'] = 'Origin';
				headers['Access-Control-Allow-Credentials'] = 'true';
			} else {
				headers['Access-Control-Allow-Origin'] = '*';
			}
		}
		headers['Access-Control-Expose-Headers'] =
			'Content-Encoding, Content-Length, Content-Type, tempo-status, tempo-message, custom-metadata, tempo-credentials';
	}

	private prepareOptionsResponse(request: IncomingMessage, response: ServerResponse): void {
		const origin = request.headers.origin;
		const preFlightRequestHeaders = request.headers['access-control-request-headers'];

		// Initialize a new ServerResponse
		let statusCode: number;
		let headers: OutgoingHttpHeaders;

		if (
			origin !== undefined &&
			request.headers['access-control-request-method'] !== undefined &&
			preFlightRequestHeaders !== undefined
		) {
			// Handle CORS pre-flight request.
			this.logger.trace('Handling CORS pre-flight request');
			headers = {
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': preFlightRequestHeaders,
				'Access-Control-Allow-Credentials': 'true',
			};

			if (this.allowedCorsOrigins !== undefined && origin !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new Error('Origin not allowed');
				}
				headers['Access-Control-Allow-Origin'] = origin;
				headers['Vary'] = 'Origin';
				this.logger.trace(`Allowing CORS for origin ${origin}`);
			} else {
				headers['Access-Control-Allow-Origin'] = '*';
			}

			statusCode = 204; // 204 No Content is the standard status for successful pre-flight requests
		} else {
			// Handle standard OPTIONS request.
			statusCode = 200; // 200 OK for standard OPTIONS request
			headers = {
				Allow: 'POST, OPTIONS',
			};
		}

		response.statusCode = statusCode;
		// Set the headers
		for (const [key, value] of Object.entries(headers)) {
			response.setHeader(key, value as string);
		}
	}

	private async setAuthContext(request: IncomingMessage, context: ServerContext): Promise<void> {
		const authHeader = request.headers.authorization;
		if (authHeader !== undefined && this.authInterceptor !== undefined) {
			const authContext = await this.authInterceptor.intercept(context, authHeader);
			context.setAuthContext(authContext);
		}
	}

	private async invokeUnaryMethod(
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
	): Promise<any> {
		await this.setAuthContext(request, context);
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
		const record = method.deserialize(requestData);
		return await method.invoke(record, context);
	}

	private async invokeClientStreamMethod(
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
	): Promise<any> {
		await this.setAuthContext(request, context);
		if (!request.readable) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'invalid request: not readable');
		}
		const generator = () => {
			return readTempoStream(
				request,
				(data: Uint8Array) => {
					if (data.length > this.maxReceiveMessageSize) {
						throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
					}
					return method.deserialize(data);
				},
				context.clientDeadline(),
			);
		};
		return await method.invoke(generator, context);
	}

	private async invokeServerStreamMethod(
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
	): Promise<AsyncGenerator<any, void, unknown>> {
		await this.setAuthContext(request, context);
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
		const record = method.deserialize(requestData);
		if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: method must be async generator');
		}
		return method.invoke(record, context);
	}

	private async invokeDuplexStreamMethod(
		request: IncomingMessage,
		context: ServerContext,
		method: BebopMethodAny,
	): Promise<AsyncGenerator<any, void, unknown>> {
		await this.setAuthContext(request, context);
		if (!request.readable) {
			throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'invalid request: not readable');
		}
		const generator = () => {
			return readTempoStream(
				request,
				(data: Uint8Array) => {
					if (data.length > this.maxReceiveMessageSize) {
						throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
					}
					return method.deserialize(data);
				},
				context.clientDeadline(),
			);
		};
		if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
			throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: method must be async generator');
		}
		return method.invoke(generator, context);
	}

	public override async process(request: IncomingMessage, response: ServerResponse, env: TEnv) {
		// Check if the request is an OPTIONS request

		if (request.method === 'OPTIONS') {
			this.prepareOptionsResponse(request, response);
			response.flushHeaders();
			response.end();
			return;
		}
		const origin = request.headers.origin;
		try {
			if (request.method !== 'POST') {
				throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'Tempo request must be "POST"');
			}
			if (!request.headers['tempo-method']) {
				throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'header "tempo-method" is missing.');
			}
			const contentType = this.getContentType(request.headers['content-type']);
			const methodId = Number(request.headers['tempo-method']);
			const method = this.registry.getMethod(methodId);
			if (!method) {
				throw new TempoError(
					TempoStatusCode.FAILED_PRECONDITION,
					`no service is registered which contains a method of '${methodId}'`,
				);
			}
			const metadataHeader = request.headers['custom-metadata'];
			const metadata =
				metadataHeader && typeof metadataHeader === 'string' ? this.getCustomMetaData(metadataHeader) : new Metadata();

			const previousAttempts = metadata.get('tempo-previous-rpc-attempts');
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
				let recordGenerator: any | undefined = undefined;
				let record: any | undefined;
				if (method.type === MethodType.Unary) {
					record = await this.invokeUnaryMethod(request, context, method);
				} else if (method.type === MethodType.ClientStream) {
					record = await this.invokeClientStreamMethod(request, context, method);
				} else if (method.type === MethodType.ServerStream) {
					recordGenerator = await this.invokeServerStreamMethod(request, context, method);
				} else if (method.type === MethodType.DuplexStream) {
					recordGenerator = await this.invokeDuplexStreamMethod(request, context, method);
				}
				// it is now safe to begin work on the response
				outgoingMetadata.freeze();
				const responseHeaders: OutgoingHttpHeaders = {};
				if (origin !== undefined) {
					this.setCorsHeaders(responseHeaders, origin);
				}
				responseHeaders['content-type'] = `application/tempo+${contentType}`;
				if (outgoingMetadata.size() > 0) {
					responseHeaders['custom-metadata'] = outgoingMetadata.toHttpHeader();
				}
				const outgoingCredentials = context.getOutgoingCredentials();
				if (outgoingCredentials) {
					responseHeaders['tempo-credentials'] = stringifyCredentials(outgoingCredentials);
				}
				responseHeaders['tempo-status'] = '0';
				responseHeaders['tempo-message'] = 'OK';
				response.statusCode = 200;
				// Set the headers
				for (const [key, value] of Object.entries(responseHeaders)) {
					response.setHeader(key, value as string);
				}
				if (recordGenerator !== undefined) {
					writeTempoStream(
						response,
						() => recordGenerator,
						(payload: any) => {
							const data = method.serialize(payload);
							if (this.maxSendMessageSize !== undefined && data.length > this.maxSendMessageSize) {
								throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'response too large');
							}
							return data;
						},
						context.clientDeadline(),
					);
				} else {
					const responseData = method.serialize(record);
					if (method.type === MethodType.Unary || method.type === MethodType.ClientStream) {
						response.setHeader('content-length', String(responseData.length));
					}
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
			const responseHeaders: OutgoingHttpHeaders = {};
			responseHeaders['tempo-status'] = `${status}`;
			responseHeaders['tempo-message'] = message;
			if (origin !== undefined) {
				this.setCorsHeaders(responseHeaders, origin);
			}
			response.statusCode = TempoError.codeToHttpStatus(status);
			for (const [key, value] of Object.entries(responseHeaders)) {
				response.setHeader(key, value as string);
			}
		}
	}

	override handle(_request: IncomingMessage, _env: TEnv): Promise<ServerResponse> {
		throw new Error('Method not implemented.');
	}
}
