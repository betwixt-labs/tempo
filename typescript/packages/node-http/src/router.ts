import {
	Deadline,
	Metadata,
	TempoError,
	TempoLogger,
	TempoStatusCode,
	TempoUtil,
	stringifyCredentials,
} from '@tempojs/common';
import {
	AuthInterceptor,
	BaseRouter,
	ObjectValidator,
	ServiceRegistry,
	TempoRouterConfiguration,
	IncomingContext,
	ServerContext,
} from '@tempojs/server';
import { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'http';
import { FetchHeadersAdapter } from './header';

/**
 * `TempoServerResponse` is an extension of the `ServerResponse` class
 * that adds a `body` property for storing response data and a `copyTo`
 * method for copying properties, headers, and body to another
 * `ServerResponse` object.
 *
 * @export
 * @class TempoServerResponse
 * @extends {ServerResponse}
 */
export class TempoServerResponse extends ServerResponse {
	/**
	 * The response body as a Uint8Array.
	 *
	 * @type {Uint8Array}
	 * @memberof TempoServerResponse
	 */
	public body?: Uint8Array;

	/**
	 * Creates an instance of TempoServerResponse.
	 *
	 * @param {IncomingMessage} request - The incoming request to be associated with the response.
	 * @memberof TempoServerResponse
	 */
	constructor(request: IncomingMessage) {
		super(request);
	}

	/**
	 * Sets the response body.
	 *
	 * @param {Uint8Array} body - The response body as a Uint8Array.
	 * @memberof TempoServerResponse
	 */
	setBody(body: Uint8Array): void {
		this.body = body;
	}

	/**
	 * Copies the status code, headers, and body (if present) from this
	 * TempoServerResponse object to another ServerResponse object.
	 *
	 * @param {ServerResponse} res - The target ServerResponse object.
	 * @returns {ServerResponse} The target ServerResponse object with the copied properties.
	 * @memberof TempoServerResponse
	 */
	copyTo(res: ServerResponse): ServerResponse {
		// Set the status code
		res.statusCode = this.statusCode;

		// Copy the headers
		const headers = this.getHeaders();
		for (const [key, value] of Object.entries(headers)) {
			res.setHeader(key, value as string);
		}

		// Write the body if present
		if (this.body) {
			res.write(this.body);
		}
		return res;
	}
}

export class TempoRouter<TEnv> extends BaseRouter<IncomingMessage, TEnv, TempoServerResponse> {
	private readonly corsEnabled: boolean;
	private readonly allowedCorsOrigins: string[] | undefined;
	private readonly transmitInternalErrors: boolean;

	constructor(
		logger: TempoLogger,
		registry: ServiceRegistry,
		configuration: TempoRouterConfiguration = { enableObjectValidation: false },
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
	private cloneHeaders(headers: IncomingHttpHeaders): FetchHeadersAdapter {
		return new FetchHeadersAdapter(headers);
	}

	setCorsHeaders(headers: OutgoingHttpHeaders, origin: string): void {
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

	private prepareOptionsResponse(request: IncomingMessage): TempoServerResponse {
		const origin = request.headers.origin;
		const preFlightRequestHeaders = request.headers['access-control-request-headers'];

		// Initialize a new ServerResponse
		const response = new TempoServerResponse(request);
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

		return response;
	}

	override async handle(request: IncomingMessage, env: TEnv): Promise<TempoServerResponse> {
		// Check if the request is an OPTIONS request
		if (request.method === 'OPTIONS') {
			return this.prepareOptionsResponse(request);
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

			// Collect request data
			const requestData = new Uint8Array(
				await new Promise<Buffer>((resolve, reject) => {
					const chunks: Buffer[] = [];
					request.on('data', (chunk: Buffer) => chunks.push(chunk));
					request.on('end', () => resolve(Buffer.concat(chunks)));
					request.on('error', (err) => reject(err));
				}),
			);
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
				this.validators,
			);

			const handleRequest = async () => {
				const authHeader = request.headers.authorization;
				if (authHeader !== undefined && this.authInterceptor !== undefined) {
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

				const responseHeaders: OutgoingHttpHeaders = {};
				if (origin !== undefined) {
					this.setCorsHeaders(responseHeaders, origin);
				}
				responseHeaders['content-length'] = String(responseData.length);
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
				const response = new TempoServerResponse(request);
				response.statusCode = 200;
				// Set the headers
				for (const [key, value] of Object.entries(responseHeaders)) {
					response.setHeader(key, value as string);
				}
				response.setBody(responseData);
				//response.write(responseData);

				return response;
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
			const responseHeaders: OutgoingHttpHeaders = {};
			responseHeaders['tempo-status'] = `${status}`;
			responseHeaders['tempo-message'] = message;
			if (origin !== undefined) {
				this.setCorsHeaders(responseHeaders, origin);
			}

			const response = new TempoServerResponse(request);
			response.statusCode = TempoError.codeToHttpStatus(status);
			for (const [key, value] of Object.entries(responseHeaders)) {
				response.setHeader(key, value as string);
			}
			return response;
		}
	}
}
