import { TempoStatusCode } from '@tempojs/common';
import { TimeSpan } from '@tempojs/common';

/**
 * The RetryPolicy interface represents a policy for retrying a failed operation based on specified criteria.
 */
export interface RetryPolicy {
	/**
	 * The maximum number of call attempts, including the original attempt. A value is required and must be greater than 1.
	 */
	maxAttempts: number;

	/**
	 * The initial backoff delay between retry attempts. A value is required and must be greater than zero.
	 */
	initialBackoff: TimeSpan;

	/**
	 * The maximum backoff places an upper limit on exponential backoff growth. A value is required and must be greater than zero.
	 */
	maxBackoff: TimeSpan;

	/**
	 * The backoff will be multiplied by this value after each retry attempt and will increase exponentially when the multiplier is greater than 1. A value is required and must be greater than zero.
	 */
	backoffMultiplier: number;

	/**
	 * A collection of status codes. A call that fails with a matching status will be automatically retried.
	 */
	retryableStatusCodes: TempoStatusCode[];
}
