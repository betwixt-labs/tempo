import { BebopRecord } from 'bebop';
import { ServerContext } from './context';
import { MethodType } from '@tempojs/common';

/**
 * The `BebopMethod` interface represents a generic Bebop method in a service.
 * It is responsible for defining the structure of a Bebop method, including
 * the necessary properties and methods for invoking, serializing, and
 * deserializing the method. It ensures that both request and response types
 * extend BebopRecord.
 *
 * @template TRequest - The type of the request data for the method, which must
 *   extend BebopRecord.
 * @template TResponse - The type of the response data for the method, which must
 *   extend BebopRecord.
 * @export
 */
export interface BebopMethod<TRequest extends BebopRecord, TResponse extends BebopRecord> {
	/**
	 * The name of the Bebop method.
	 */
	name: string;

	/**
	 * The name of the service that the Bebop method belongs to.
	 */
	service: string;

	invoke(
		value: TRequest | (() => AsyncGenerator<TRequest, void, undefined>),
		context: ServerContext,
	): Promise<TResponse> | TResponse | AsyncGenerator<TResponse, void, undefined>;

	/**
	 * The method responsible for serializing the response
	 * data into a Uint8Array.
	 */
	serialize(value: TResponse): Uint8Array;

	/**
	 * The method responsible for deserializing the
	 * request data from a Uint8Array.
	 */
	deserialize(data: Uint8Array): TRequest;

	/**
	 * The type of the method.
	 */
	type: MethodType;
}

export type BebopMethodAny = BebopMethod<any, any>;
