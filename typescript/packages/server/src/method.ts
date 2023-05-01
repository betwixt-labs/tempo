import { BebopRecord } from 'bebop';
import { ServerContext } from './context';

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
 * @property {string} name - The name of the Bebop method.
 * @property {string} service - The name of the service that the Bebop method belongs to.
 * @method {Function} invoke - The method that will be called with the request data and
 *   a ServerContext object. It returns either a Promise of the response data, or the
 *   response data directly.
 * @method {Function} serialize - The method responsible for serializing the response
 *   data into a Uint8Array.
 * @method {Function} deserialize - The method responsible for deserializing the
 *   request data from a Uint8Array.
 * @export
 */
export interface BebopMethod<TRequest extends BebopRecord, TResponse extends BebopRecord> {
	name: string;
	service: string;
	invoke(value: TRequest, context: ServerContext): Promise<TResponse> | TResponse;
	serialize(value: TResponse): Uint8Array;
	deserialize(data: Uint8Array): TRequest;
}
export type BebopMethodAny = BebopMethod<any, any>;
