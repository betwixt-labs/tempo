import {
	Metadata,
	TempoLogger,
	TempoError,
	TempoStatusCode,
	TempoUtil,
	stringifyCredentials,
	Deadline,
} from '@tempojs/common';
import {
	BaseRouter,
	ServerContext,
	ServiceRegistry,
	AuthInterceptor,
	IncomingContext,
	TempoRouterConfiguration,
	ObjectValidator,
} from '@tempojs/server';

export class TempoRouter<TEnv> extends BaseRouter<Request, TEnv, Response> {
	private readonly corsEnabled: boolean;
	private readonly allowedCorsOrigins: string[] | undefined;
	private readonly transmitInternalErrors: boolean;

	constructor(
		logger: TempoLogger,
		registry: ServiceRegistry,
		configuration: TempoRouterConfiguration = { enableObjectValidation: true },
		authInterceptor?: AuthInterceptor,
	) {
		super(logger, registry, authInterceptor);
		if (configuration.enableObjectValidation) {
			this.validators.set('object', new ObjectValidator(logger));
		}
		if (configuration.validators) {
			for (const [name, validator] of configuration.validators) {
				this.validators.set(name, validator);
			}
		}
		this.corsEnabled = configuration.enableCors ??= false;
		this.allowedCorsOrigins = configuration.allowedOrigins;
		this.transmitInternalErrors = configuration.transmitInternalErrors ??= false;
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
		const origin = request.headers.get('Origin');
		const preFlightRequestHeaders = request.headers.get('Access-Control-Request-Headers');
		if (
			origin !== null &&
			request.headers.get('Access-Control-Request-Method') !== null &&
			preFlightRequestHeaders !== null
		) {
			// Handle CORS pre-flight request.
			this.logger.trace('Handling CORS pre-flight request');
			const headers: HeadersInit = {
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': preFlightRequestHeaders,
				'Access-Control-Allow-Credentials': 'true',
			};
			if (this.allowedCorsOrigins !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new Error('Origin not allowed');
				}
				headers['Access-Control-Allow-Origin'] = origin;
				headers['Vary'] = 'Origin';
				this.logger.trace(`Allowing CORS for origin ${origin}`);
			} else {
				headers['Access-Control-Allow-Origin'] = '*';
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

	setCorsHeaders(headers: Headers, origin: string): void {
		if (this.corsEnabled) {
			if (this.allowedCorsOrigins !== undefined) {
				if (!this.allowedCorsOrigins.includes(origin)) {
					throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'origin not allowed');
				}
				headers.set('Access-Control-Allow-Origin', origin);
				headers.append('Vary', 'Origin');
				headers.set('Access-Control-Allow-Credentials', 'true');
			} else {
				headers.set('Access-Control-Allow-Origin', '*');
			}
		}
		headers.set(
			'Access-Control-Expose-Headers',
			'Content-Encoding, Content-Length, Content-Type, tempo-status, tempo-message, custom-metadata, tempo-credentials',
		);
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
		const origin = request.headers.get('origin');
		try {
			if (request.method !== 'POST') {
				throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'Tempo request must be "POST"');
			}
			if (!request.headers.has('tempo-method')) {
				throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'header "tempo-method" is missing.');
			}
			const contentType = this.getContentType(request.headers.get('content-type'));
			const methodId = Number(request.headers.get('tempo-method'));
			const method = this.registry.getMethod(methodId);
			if (!method) {
				throw new TempoError(
					TempoStatusCode.FAILED_PRECONDITION,
					`no service is registered which contains a method of '${methodId}'`,
				);
			}
			const metadata = this.getCustomMetaData(request.headers.get('custom-metadata'));
			const requestData = new Uint8Array(await request.arrayBuffer());
			let requestBody: any;
			switch (contentType) {
				case 'json':
					requestBody = JSON.parse(TempoUtil.textDecoder.decode(requestData));
					break;
				case 'bebop':
					requestBody = method.deserialize(requestData);
					break;
				default:
					throw new TempoError(TempoStatusCode.UNKNOWN_CONTENT_TYPE, `invalid request: unknown format ${contentType}`);
			}
			const objectValidator = this.validators.get('object') as ObjectValidator;
			if (objectValidator && !objectValidator.sanitize(requestBody)) {
				throw new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'request data failed to be sanitized');
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
				this.validators,
			);

			const handleRequest = async () => {
				const authHeader = request.headers.get('authorization');
				if (authHeader !== null && this.authInterceptor !== undefined) {
					const authContext = await this.authInterceptor.intercept(context, authHeader);
					context.setAuthContext(authContext);
				}

				const result = await method.invoke(requestBody, context);
				// it is now safe to begin work on the response
				outgoingMetadata.freeze();
				let responseData: Uint8Array;
				switch (contentType) {
					case 'json':
						responseData = TempoUtil.textEncoder.encode(result);
						break;
					case 'bebop':
						responseData = method.serialize(result);
						break;
					default:
						throw new TempoError(
							TempoStatusCode.UNKNOWN_CONTENT_TYPE,
							`invalid request: unknown format ${contentType}`,
						);
				}

				const responseHeaders = new Headers();
				if (origin !== null) {
					this.setCorsHeaders(responseHeaders, origin);
				}
				responseHeaders.set('content-type', `application/tempo+${contentType}`);
				responseHeaders.set('content-length', String(responseData.length));
				if (outgoingMetadata.size() > 0) {
					responseHeaders.set('custom-metadata', outgoingMetadata.toHttpHeader());
				}
				const outgoingCredentials = context.getOutgoingCredentials();
				if (outgoingCredentials) {
					responseHeaders.set('tempo-credentials', stringifyCredentials(outgoingCredentials));
				}

				responseHeaders.set('tempo-status', '0');
				responseHeaders.set('tempo-message', 'OK');
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
					? this.logger.critical(message, undefined, e)
					: this.logger.error(message, undefined, e);
			} else if (e instanceof Error) {
				message = e.message;
				this.logger.error(message, undefined, e);
			}
			const responseHeaders = new Headers();
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
}
