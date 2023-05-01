import { TempoContentType, TempoError, TempoLogger, TempoStatusCode } from '@tempojs/common';
import { ServiceRegistry } from './registry';
import { Validator } from './validator';
import { AuthInterceptor } from './intercept';
import { Metadata } from '@tempojs/common';

/**
 * Interface defining the configuration options for a TempoRouter instance.
 */
export interface TempoRouterConfiguration {
	/**
	 * Indicates whether to enable object validation for incoming requests.
	 */
	enableObjectValidation: boolean;

	/**
	 * Optional map of validators, where the key is a string representing the
	 * validator name and the value is a Validator instance.
	 */
	validators?: Map<string, Validator>;

	/**
	 * Optional flag to enable CORS (Cross-Origin Resource Sharing) support.
	 */
	enableCors?: boolean;

	/**
	 * Optional list of allowed origins for CORS. Ignored if enableCors is false.
	 */
	allowedOrigins?: string[];

	/**
	 * Optional flag to indicate whether internal errors should be transmitted
	 * in the API response. Defaults to false, meaning internal errors are
	 * masked and not exposed to clients.
	 */
	transmitInternalErrors?: boolean;
}

/**
 * Represents an abstract base class for a router that handles incoming requests, performs validation, and routes
 * them to the appropriate services and methods in a Tempo application.
 *
 * @template TRequest - The type of the request object.
 * @template TEnvironment - The type of the environment/context object.
 * @template TResponse - The type of the response object.
 */
export abstract class BaseRouter<TRequest, TEnvironment, TResponse> {
	/**
	 * A map of validator names to their corresponding Validator instances.
	 */
	protected readonly validators: Map<string, Validator>;

	/**
	 * Constructs a new BaseRouter instance.
	 * @param logger - The logger to use for logging router-related information.
	 * @param registry - The service registry instance that manages services and methods for this router.
	 * @param authInterceptor - The interceptor (if any) that will be used for authenticating the peer of an incoming requests.
	 */
	constructor(
		protected readonly logger: TempoLogger,
		protected readonly registry: ServiceRegistry,
		protected readonly authInterceptor?: AuthInterceptor,
	) {
		this.validators = new Map<string, Validator>();
		this.registry.init();
	}

	/**
	 * Handles an incoming request by routing it to the appropriate service and method, applying any necessary
	 * validation and processing.
	 *
	 * @param request - The incoming request object.
	 * @param env - The environment/context object associated with the request.
	 * @returns A promise that resolves to the response object.
	 */
	abstract handle(request: TRequest, env: TEnvironment): Promise<TResponse>;

	/**
	 * Protected function that retrieves the content type from the header.
	 *
	 * @private
	 * @function
	 * @throws {Error} When the content type header is not present, when it doesn't contain "application/tempo"
	 * or when it doesn't have a format specified.
	 * @param {string | null} header The content type header from the request.
	 * @returns {TempoContentType} The content type of the request.
	 */
	protected getContentType(header: string | null | undefined): TempoContentType {
		if (!header) {
			throw new TempoError(TempoStatusCode.UNKNOWN_CONTENT_TYPE, 'invalid request: no content type header');
		}
		if (!header.includes('application/tempo')) {
			throw new TempoError(
				TempoStatusCode.UNKNOWN_CONTENT_TYPE,
				'invalid request: content type does not include application/tempo',
			);
		}
		if (!header.includes('+')) {
			throw new TempoError(TempoStatusCode.UNKNOWN_CONTENT_TYPE, 'invalid request: no format on content type');
		}
		const format = header.split('+')[1];
		if (format === 'bebop' || format === 'json') {
			return format;
		}
		throw new TempoError(TempoStatusCode.UNKNOWN_CONTENT_TYPE, `invalid request: unknown format ${format}`);
	}

	/**
	 * Private function that retrieves custom metadata from the header.
	 *
	 * @private
	 * @function
	 * @param {string | null} value The custom metadata value from the request.
	 * @returns {Metadata} The metadata object.
	 */
	protected getCustomMetaData(value: string | null | undefined): Metadata {
		if (!value) {
			return new Metadata();
		}
		return Metadata.fromHttpHeader(value);
	}
}
