import { TempoLogger, Deadline, BebopContentType } from '@tempojs/common';
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
	 * The maximum size of the message that can be sent.
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
	 * The content type to use for the channel. Defaults to the value in `TempoChannel.defaultContentType`.
	 */
	public contentType?: BebopContentType;

	/**
	 * Constructs a new instance of TempoChannelOptions with default values.
	 */
	constructor() {
		this.contentType = TempoChannel.defaultContentType;
		this.maxReceiveMessageSize = TempoChannel.defaultMaxReceiveMessageSize;
		this.maxRetryAttempts = TempoChannel.defaultMaxRetryAttempts;
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
