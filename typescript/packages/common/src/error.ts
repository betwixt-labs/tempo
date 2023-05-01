import { TempoStatusCode } from './status';

export class TempoError extends Error {
	status: TempoStatusCode;

	constructor(statusCode: TempoStatusCode, message: string, cause?: Error | Record<string, any>) {
		super(message, { cause: cause });
		this.name = 'TempoError';
		this.status = statusCode;
		// Set the prototype explicitly to make 'instanceof' work correctly
		Object.setPrototypeOf(this, new.target.prototype);
	}

	static httpStatusToError(httpStatus: number): TempoError {
		switch (httpStatus) {
			case 0: // Connectivity issues
				return new TempoError(TempoStatusCode.INTERNAL, 'Connectivity issues');
			case 200:
				return new TempoError(TempoStatusCode.OK, 'OK');
			case 400:
				return new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'Invalid argument');
			case 401:
				return new TempoError(TempoStatusCode.UNAUTHENTICATED, 'Unauthenticated');
			case 403:
				return new TempoError(TempoStatusCode.PERMISSION_DENIED, 'Permission denied');
			case 404:
				return new TempoError(TempoStatusCode.NOT_FOUND, 'Not found');
			case 409:
				return new TempoError(TempoStatusCode.ABORTED, 'Aborted');
			case 412:
				return new TempoError(TempoStatusCode.FAILED_PRECONDITION, 'Failed precondition');
			case 429:
				return new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'Resource exhausted');
			case 499:
				return new TempoError(TempoStatusCode.CANCELLED, 'Canceled');
			case 500:
				return new TempoError(TempoStatusCode.UNKNOWN, 'Unknown error');
			case 501:
				return new TempoError(TempoStatusCode.UNIMPLEMENTED, 'Unimplemented');
			case 503:
				return new TempoError(TempoStatusCode.UNAVAILABLE, 'Unavailable');
			case 504:
				return new TempoError(TempoStatusCode.DEADLINE_EXCEEDED, 'Deadline exceeded');
			default:
				return new TempoError(TempoStatusCode.UNKNOWN, 'Unknown error');
		}
	}

	static codeToHttpStatus(code: TempoStatusCode): number {
		switch (code) {
			case TempoStatusCode.OK:
				return 200;
			case TempoStatusCode.CANCELLED:
				return 499;
			case TempoStatusCode.UNKNOWN:
				return 500;
			case TempoStatusCode.INVALID_ARGUMENT:
				return 400;
			case TempoStatusCode.DEADLINE_EXCEEDED:
				return 504;
			case TempoStatusCode.NOT_FOUND:
				return 404;
			case TempoStatusCode.ALREADY_EXISTS:
				return 409;
			case TempoStatusCode.PERMISSION_DENIED:
				return 403;
			case TempoStatusCode.RESOURCE_EXHAUSTED:
				return 429;
			case TempoStatusCode.FAILED_PRECONDITION:
				return 412;
			case TempoStatusCode.ABORTED:
				return 409;
			case TempoStatusCode.OUT_OF_RANGE:
				return 400;
			case TempoStatusCode.UNIMPLEMENTED:
				return 501;
			case TempoStatusCode.INTERNAL:
				return 500;
			case TempoStatusCode.UNAVAILABLE:
				return 503;
			case TempoStatusCode.DATA_LOSS:
				return 500;
			case TempoStatusCode.UNAUTHENTICATED:
				return 401;
			case TempoStatusCode.UNKNOWN_CONTENT_TYPE:
				return 415;
			default:
				return 500;
		}
	}

	/**
	 * Checks if the given error is an instance of `TempoError`.
	 *
	 * @param error - The error object to check.
	 * @returns A boolean value indicating whether the error is an instance of `TempoError`.
	 */
	public static isTempoError(error: any): error is TempoError {
		return error instanceof TempoError;
	}
}
