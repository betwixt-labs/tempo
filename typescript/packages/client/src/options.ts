import { TempoLogger, Deadline, TempoContentType } from '@tempojs/common';
import { TempoChannel as TempoChannel } from './channel';
import { RetryPolicy } from './retry';
import { CallCredentials } from './auth';

/**
 * Represents the configuration options for a TempoChannel.
 */
export class TempoChannelOptions {
	/**
	 * An optional logger instance for logging purposes.
	 */
	public logger?: TempoLogger;

	/**
	 * The content type used for encoding and decoding messages. Defaults to the value in `TempoChannel.defaultContentType`.
	 */
	public contentType?: TempoContentType;

	/**
	 * The maximum size of the message that can be sent. Defaults to the value in `TempoChannel.defaultMaxReceiveMessageSize`.
	 */
	public maxSendMessageSize?: number;

	/**
	 * The maximum size of the message that can be received. Defaults to the value in `TempoChannel.defaultMaxReceiveMessageSize`.
	 */
	public maxReceiveMessageSize?: number;

	/**
	 * The maximum number of retry attempts for failed requests. Defaults to the value in `TempoChannel.defaultMaxRetryAttempts`.
	 */
	public maxRetryAttempts?: number;

	/**
	 * The credentials handler to be used for storing and setting authentication information on calls. Defaults to the value in `TempoChannel.defaultCredentials`.
	 */
	public credentials?: CallCredentials;

	/**
	 * CallCredentials are only applied if the channel is transporting over HTTPS.
	 * Sending authentication headers over an insecure connection has security implications and shouldn't be done in production environments.
	 * An app can configure a channel to ignore this behavior and always use CallCredentials by setting unsafeUseInsecureChannelCallCredentials on a channel.
	 */
	public unsafeUseInsecureChannelCallCredentials?: boolean;

	/**
	 * Constructs a new instance of TempoChannelOptions with default values.
	 */
	constructor() {
		this.maxReceiveMessageSize = TempoChannel.defaultMaxReceiveMessageSize;
		this.maxRetryAttempts = TempoChannel.defaultMaxRetryAttempts;
		this.contentType = TempoChannel.defaultContentType;
		this.credentials = TempoChannel.defaultCredentials;
		this.unsafeUseInsecureChannelCallCredentials = false;
	}
}

/**
 * Represents the configuration options for a single RPC call.
 */
export interface CallOptions {
	/**
	 * The deadline for the call, after which the call should be cancelled.
	 */
	deadline?: Deadline;

	/**
	 * The AbortController instance, which can be used to cancel the call.
	 */
	controller?: AbortController;

	/**
	 * The retry policy to apply for the call in case of failures.
	 */
	retryPolicy?: RetryPolicy;
}
