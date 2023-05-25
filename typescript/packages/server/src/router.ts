import { TempoError, TempoLogger, TempoStatusCode } from '@tempojs/common';
import { ServiceRegistry } from './registry';
import { AuthInterceptor } from './intercept';
import { Metadata, HookRegistry } from '@tempojs/common';
import { ServerContext } from './context';

/**
 * Interface defining the configuration options for a TempoRouter instance.
 */
export class TempoRouterConfiguration {
	public static readonly defaultMaxRetryAttempts: number = 5;
	public static readonly defaultMaxReceiveMessageSize: number = 1024 * 1024 * 4; // 4 MB
	public static readonly defaultMaxSendMessageSize: number = 1024 * 1024 * 4; // 4 MB
	/**
	 * Optional flag to enable CORS (Cross-Origin Resource Sharing) support.
	 */
	public enableCors?: boolean;

	/**
	 * Optional list of allowed origins for CORS. Ignored if enableCors is false.
	 */
	public allowedOrigins?: string[];

	/**
	 * Optional flag to indicate whether internal errors should be transmitted
	 * in the API response. Defaults to false, meaning internal errors are
	 * masked and not exposed to clients.
	 */
	public transmitInternalErrors?: boolean;

	/**
	 * The maximum size of the message that can be received. Defaults to the value in `TempoRouterConfiguration.defaultMaxReceiveMessageSize`.
	 */
	public maxReceiveMessageSize?: number;

	/**
	 * The maximum size of the message that can be sent.
	 */
	public maxSendMessageSize?: number;

	/**
	 * The maximum number of retry attempts for failed requests. Defaults to the value in `TempoRouterConfiguration.defaultMaxRetryAttempts`.
	 */
	public maxRetryAttempts?: number;

	/**
	 * Constructs a new instance of TempoRouterConfiguration with default values.
	 */
	constructor() {
		this.maxReceiveMessageSize = TempoRouterConfiguration.defaultMaxReceiveMessageSize;
		this.maxRetryAttempts = TempoRouterConfiguration.defaultMaxRetryAttempts;
		this.maxRetryAttempts = TempoRouterConfiguration.defaultMaxRetryAttempts;
	}
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
	protected readonly corsEnabled: boolean;
	protected readonly allowedCorsOrigins: string[] | undefined;
	protected readonly transmitInternalErrors: boolean;
	protected readonly maxReceiveMessageSize: number;
	protected readonly maxSendMessageSize?: number;
	protected readonly maxRetryAttempts: number;
	protected hooks?: HookRegistry<ServerContext, TEnvironment>;

	/**
	 * Constructs a new BaseRouter instance.
	 * @param logger - The logger to use for logging router-related information.
	 * @param registry - The service registry instance that manages services and methods for this router.
	 * @param authInterceptor - The interceptor (if any) that will be used for authenticating the peer of an incoming requests.
	 */
	constructor(
		protected readonly logger: TempoLogger,
		protected readonly registry: ServiceRegistry,
		protected readonly configuration: TempoRouterConfiguration,
		protected readonly authInterceptor?: AuthInterceptor,
	) {
		this.corsEnabled = configuration.enableCors ??= false;
		this.allowedCorsOrigins = configuration.allowedOrigins;
		this.transmitInternalErrors = configuration.transmitInternalErrors ??= false;
		this.maxReceiveMessageSize =
			configuration.maxReceiveMessageSize ?? TempoRouterConfiguration.defaultMaxReceiveMessageSize;
		if (configuration.maxSendMessageSize !== undefined) {
			this.maxSendMessageSize = configuration.maxSendMessageSize;
		}
		this.maxRetryAttempts = configuration.maxRetryAttempts ?? TempoRouterConfiguration.defaultMaxRetryAttempts;
		this.registry.init();
	}

	/**
	 * Handles an incoming request by routing it to the appropriate service and method, applying any necessary
	 * validation and processing and returns a response.
	 *
	 * @param request - The incoming request object.
	 * @param env - The environment/context object associated with the request.
	 * @returns A promise that resolves to the response object.
	 */
	abstract handle(request: TRequest, env: TEnvironment): Promise<TResponse>;

	/**
	 * Processes an incoming request by routing it to the appropriate service and method, applying any necessary
	 * validation and processing, in place on the provided response object.
	 *
	 * @param request - The incoming request object.
	 * @param response - The outgoing response object.
	 * @param env - The environment/context object associated with the request.
	 */
	abstract process(request: TRequest, response: TResponse, env: TEnvironment): Promise<void>;

	/**
	 * Protected function that retrieves the content type from the header.
	 *
	 * @private
	 * @function
	 * @throws {Error} When the content type header is not present, when it doesn't contain "application/tempo"
	 * or when it doesn't have a format specified.
	 * @param {string | null} header The content type header from the request.
	 * @returns {string} The content type of the request.
	 */
	protected getContentType(header: string | null | undefined): string {
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
		if (format === 'bebop') {
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

	/**
	 * Defines a hook registry for the router.
	 * @param hooks - The hook registry to be used.
	 */
	public useHooks(hooks: HookRegistry<ServerContext, TEnvironment>): void {
		this.hooks = hooks;
	}
}
