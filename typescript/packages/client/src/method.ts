import { MethodType } from '@tempojs/common';
import { BebopRecord } from 'bebop';

/**
 * Represents a method within a service that uses Bebop serialization.
 * @template TRequest - The type of the request object, which must extend BebopRecord.
 * @template TResponse - The type of the response object, which must extend BebopRecord.
 */
export interface MethodInfo<TRequest extends BebopRecord, TResponse extends BebopRecord> {
	/**
	 * The name of the method.
	 */
	name: string;

	/**
	 * The name of the service that the method belongs to.
	 */
	service: string;

	/**
	 * A unique identifier for the method.
	 */
	id: number;

	/**
	 * Serializes the given request object into a Uint8Array.
	 * @param value - The request object to serialize.
	 * @returns A Uint8Array containing the serialized data.
	 */
	serialize(value: TRequest): Uint8Array;

	/**
	 * Deserializes the given Uint8Array into a response object.
	 * @param data - The Uint8Array containing the serialized data.
	 * @returns The deserialized response object.
	 */
	deserialize(data: Uint8Array): TResponse;

	/**
	 * Converts the given request object to a JSON string.
	 * @param value - The request object to convert.
	 * @returns A JSON string representation of the request object.
	 */
	toJSON(value: TRequest): string;

	/**
	 * Converts the given JSON string to a response object.
	 * @param data - The JSON string to convert.
	 * @returns The response object.
	 */
	fromJSON(data: string): TResponse;

	/**
	 * The type of the method.
	 */
	type: MethodType;
}
