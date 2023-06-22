import { Deadline, TempoError, TempoStatusCode, tempoStream } from '@tempojs/common';
import { BebopRecord } from 'bebop';
import { Readable, Writable } from 'stream';

const CRLF_LENGTH = 2;
/**
 * Reads and decodes payloads from a Node.js Readable stream of Uint8Array.
 *
 * @template TRecord - The type of the decoded payload.
 * @param {Readable} stream - The ReadableStream to read from.
 * @param {(buffer: Uint8Array) => TRecord} decoder - The function to decode the payload.
 * @param {Deadline} deadline - The deadline for the stream.
 * @param {AbortController} abortController - The controller for aborting the stream.
 * @yields {TRecord} The decoded payload.
 * @throws {TempoError} If the stream ends in the middle of a Tempo stream frame; this indicates a data loss.
 */
export async function* readTempoStream<TRecord extends BebopRecord>(
	stream: Readable,
	decoder: (buffer: Uint8Array) => Promise<TRecord>,
	deadline?: Deadline,
	abortController?: AbortController,
): AsyncGenerator<TRecord, void, undefined> {
	let buffer = new Uint8Array(2048);
	let writeIndex = 0;
	let readIndex = 0;
	let payloadSize = 0;

	const listener = (resolve: (value: Uint8Array) => void, reject: (error: Error) => void) => {
		const onData = (chunk: Uint8Array) => {
			stream.off('error', onError);
			resolve(chunk);
		};
		const onError = (error: Error) => {
			stream.off('data', onData);
			reject(error);
		};
		stream.once('data', onData);
		stream.once('error', onError);
	};

	try {
		while (true) {
			const value = await (deadline
				? deadline.executeWithinDeadline(async () => await new Promise<Uint8Array>(listener), abortController)
				: await new Promise<Uint8Array>(listener));

			if (writeIndex + value.length > buffer.length) {
				const newBuffer = new Uint8Array(buffer.length + value.length);
				newBuffer.set(buffer);
				buffer = newBuffer;
			}

			buffer.set(value, writeIndex);
			writeIndex += value.length;

			while (writeIndex - readIndex >= tempoStream.FRAME_HEADER_LENGTH) {
				const header = tempoStream.readFrameHeaderFromBuffer(buffer, readIndex);
				readIndex += tempoStream.FRAME_HEADER_LENGTH;
				payloadSize = header.length;

				if (header.flags & tempoStream.getFlag('END_STREAM')) {
					return;
				}

				if (payloadSize !== 0) {
					if (writeIndex - readIndex < payloadSize + CRLF_LENGTH) {
						break;
					}
					yield await decoder(buffer.subarray(readIndex, readIndex + payloadSize));
					readIndex += payloadSize + CRLF_LENGTH;
				}
			}

			if (writeIndex - readIndex !== 0) {
				throw new TempoError(
					TempoStatusCode.DATA_LOSS,
					`Stream ended in the middle of a Tempo stream frame; ${writeIndex - readIndex} bytes of data were lost`,
				);
			}
		}
	} finally {
		stream.removeAllListeners();
	}
}

/**
 * Writes data from an asynchronous generator to a writable stream using a specified encoder.
 * @template TRecord - The type of the records generated by the generator.
 * @param {Writable} stream - The writable stream to write the data to.
 * @param {AsyncGenerator<TRecord, void, undefined> | undefined} recordGenerator - The asynchronous generator function that produces the records.
 * @param {(payload: TRecord) => Uint8Array} encoder - The function that encodes a record into a Uint8Array payload.
 * @param {Deadline} deadline - The deadline for the stream.
 * @param {AbortController} abortController - The controller for aborting the stream.
 * @returns {Promise<void>} - A Promise that resolves when all records have been written to the stream.
 */
export async function writeTempoStream<TRecord extends BebopRecord>(
	stream: Writable,
	recordGenerator: AsyncGenerator<TRecord, void, undefined> | undefined,
	encoder: (payload: TRecord) => Uint8Array,
	deadline?: Deadline,
	abortController?: AbortController,
): Promise<void> {
	const streamId = tempoStream.generateStreamIdentifier();
	let writeIndex = 0; // keep track of where to write data
	let buffer = new Uint8Array(2048);
	const header = {
		length: 0,
		reserved: 0,
		flags: 0,
		streamIdentifier: streamId,
	};
	if (recordGenerator === undefined) {
		throw new TempoError(TempoStatusCode.INTERNAL, 'record generator is undefined');
	}
	const writeFrame = async (payload: Uint8Array) => {
		const requiredLength = writeIndex + tempoStream.FRAME_HEADER_LENGTH + payload.length + CRLF_LENGTH;
		if (requiredLength > buffer.length) {
			const newBuffer = new Uint8Array(requiredLength);
			newBuffer.set(buffer);
			buffer = newBuffer;
		}
		header.length = payload.length;
		tempoStream.writeFrameHeaderToBuffer(buffer, header, writeIndex);
		writeIndex += tempoStream.FRAME_HEADER_LENGTH;
		buffer.set(payload, writeIndex);
		writeIndex += payload.length;
		buffer[writeIndex++] = 0x0d;
		buffer[writeIndex++] = 0x0a;
		stream.write(buffer.slice(0, writeIndex));
		writeIndex = 0; // reset writeIndex after sending
	};

	const writeFrames = async () => {
		for await (const value of recordGenerator) {
			const payload = encoder(value);
			await writeFrame(payload);
		}
	};

	if (deadline) {
		await deadline.executeWithinDeadline(writeFrames, abortController);
	} else {
		await writeFrames();
	}

	// Write END_OF_STREAM frame header
	header.length = 0;
	header.flags = tempoStream.getFlag('END_STREAM');
	tempoStream.writeFrameHeaderToBuffer(buffer, header, writeIndex);
	stream.write(buffer.slice(0, tempoStream.FRAME_HEADER_LENGTH));
	stream.end();
}
