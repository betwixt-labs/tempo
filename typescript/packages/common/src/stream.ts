import { BebopRecord } from 'bebop';
import { TempoError } from './error';
import { TempoStatusCode } from './status';
import { Deadline } from './deadline';

// various methods & types shared across stream implementations
export const FRAME_HEADER_LENGTH = 9;
/**
 * Tempo stream frame header.
 *
 * The header is 9 bytes and arranged as follows:
 *
 * @property {number} length - The length of the frame payload in bytes. This is a 24-bit unsigned integer.
 * @property {number} reserved - A reserved 8-bit field. This is intended for future use.
 * @property {number} flags - Flags specific to the frame. This is an 8-bit field.
 * @property {number} streamIdentifier - The identifier of the stream this frame is part of. This is a 31-bit field,
 * where the most significant bit (MSB) is reserved and should always be 0.
 */
export interface TempoFrameHeader {
	length: number;
	reserved: number;
	flags: number;
	streamIdentifier: number;
}

/**
 * Reads Tempo stream frame header from a buffer.
 *
 * @param buffer - The buffer to read the header from. Must be at least 9 bytes.
 * @param offset - The offset in the buffer to read the header from.
 * @returns The read Tempo stream frame header.
 */
export const readFrameHeaderFromBuffer = (buffer: Uint8Array, offset: number): TempoFrameHeader => {
	if (buffer.byteLength < offset + FRAME_HEADER_LENGTH) {
		throw new TempoError(
			TempoStatusCode.OUT_OF_RANGE,
			'Buffer must be at least 9 bytes to read a Tempo stream frame header',
		);
	}
	const view = new DataView(buffer.buffer, buffer.byteOffset + offset, FRAME_HEADER_LENGTH);
	const length = (view.getUint8(0) << 16) | (view.getUint8(1) << 8) | view.getUint8(2);
	const reserved = view.getUint8(3);
	const flags = view.getUint8(4);
	const streamIdentifier = view.getUint32(5) & 0x7fffffff; // Mask off the MSB

	if (length < 0 || length > 0xffffff) {
		throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'Length must be between 0 and 16777215 (inclusive)');
	}
	if (reserved < 0 || reserved > 0xff) {
		throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'Reserved must be between 0 and 255 (inclusive)');
	}
	if (flags < 0 || flags > 0xff) {
		throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'Flags must be between 0 and 255 (inclusive)');
	}
	if (streamIdentifier < 0 || streamIdentifier > 0x7fffffff) {
		throw new TempoError(
			TempoStatusCode.OUT_OF_RANGE,
			'Stream Identifier must be between 0 and 2147483647 (inclusive)',
		);
	}

	return { length, reserved, flags, streamIdentifier };
};

/**
 * Writes a Tempo stream frame header to a buffer.
 *
 * @param buffer - The buffer to write the header to. Must be at least 9 bytes.
 * @param header - The Tempo stream frame header to write.
 * @throws {RangeError} If the buffer is less than 9 bytes.
 * @throws {RangeError} If any of the header values are out of range.
 */
export const writeFrameHeaderToBuffer = (buffer: Uint8Array, header: TempoFrameHeader, writeIndex: number): void => {
	if (buffer.byteLength < writeIndex + FRAME_HEADER_LENGTH) {
		throw new TempoError(
			TempoStatusCode.OUT_OF_RANGE,
			'Buffer must be at least 9 bytes to write a Tempo stream frame header',
		);
	}
	if (header.length < 0 || header.length > 0xffffff) {
		throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'Length must be between 0 and 16777215 (inclusive)');
	}
	if (header.reserved < 0 || header.reserved > 0xff) {
		throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'Reserved must be between 0 and 255 (inclusive)');
	}
	if (header.flags < 0 || header.flags > 0xff) {
		throw new TempoError(TempoStatusCode.OUT_OF_RANGE, 'Flags must be between 0 and 255 (inclusive)');
	}
	if (header.streamIdentifier < 0 || header.streamIdentifier > 0x7fffffff) {
		throw new TempoError(
			TempoStatusCode.OUT_OF_RANGE,
			'Stream Identifier must be between 0 and 2147483647 (inclusive)',
		);
	}

	const view = new DataView(buffer.buffer, buffer.byteOffset + writeIndex, FRAME_HEADER_LENGTH);
	view.setUint8(0, (header.length >> 16) & 0xff);
	view.setUint8(1, (header.length >> 8) & 0xff);
	view.setUint8(2, header.length & 0xff);
	view.setUint8(3, header.reserved);
	view.setUint8(4, header.flags);
	view.setUint32(5, header.streamIdentifier & 0x7fffffff); // Mask off the MSB
};

/**
 * Generates a random stream identifier within range [1, 2^31 - 1].
 * @returns A random stream identifier.
 */
export const generateStreamIdentifier = (): number => {
	return Math.floor(Math.random() * (Math.pow(2, 31) - 1)) + 1;
};
/**
 * Tempo stream frame flags.
 */
export type TempoStreamFlag = 'UNKNOWN_FLAG' | 'END_STREAM' | 'ACK' | 'PRIORITY';

/**
 * Gets the flag value for a given flag name.
 * @param flagName The flag name.
 * @returns The flag value.
 */
export const getFlag = (flagName: TempoStreamFlag): number => {
	const flags: { [key: string]: number } = {
		END_STREAM: 0x1,
		ACK: 0x2,
		PRIORITY: 0x20,
		UNKNOWN_FLAG: 0x0,
	};
	return flags[flagName] || 0;
};

/**
 * Reads and decodes payloads from a ReadableStream of Uint8Array.
 *
 * @async
 * @generator
 * @template TRecord - The type of the decoded payload.
 * @param {ReadableStream<Uint8Array>} stream - The ReadableStream to read from.
 * @param {(buffer: Uint8Array) => TRecord} decoder - The function to decode the payload.
 * @yields {TRecord} The decoded payload.
 * @throws {TempoError} If the stream ends in the middle of a Tempo stream frame; this indicates a data loss.
 */
export async function* readTempoStream<TRecord extends BebopRecord>(
	stream: ReadableStream<Uint8Array>,
	decoder: (buffer: Uint8Array) => TRecord,
	deadline?: Deadline,
	abortController?: AbortController,
): AsyncGenerator<TRecord, void, undefined> {
	const reader = stream.getReader();
	let buffer = new Uint8Array(2048);
	let writeIndex = 0;
	let readIndex = 0;
	let payloadSize = 0;
	let stopRequested = false;

	try {
		while (!stopRequested) {
			const { done, value } = await (deadline
				? deadline.executeWithinDeadline(async () => await reader.read(), abortController)
				: await reader.read());

			if (done) {
				stopRequested = true;
			}

			if (value !== undefined) {
				if (writeIndex + value.length > buffer.length) {
					const newBuffer = new Uint8Array(buffer.length + value.length);
					newBuffer.set(buffer);
					buffer = newBuffer;
				}
				buffer.set(value, writeIndex);
				writeIndex += value.length;
			}

			while (writeIndex - readIndex >= FRAME_HEADER_LENGTH) {
				const header = readFrameHeaderFromBuffer(buffer, readIndex);
				readIndex += FRAME_HEADER_LENGTH;
				payloadSize = header.length;

				if (header.flags & getFlag('END_STREAM')) {
					stopRequested = true;
					break;
				}
				// Only wait for the next frame if the current payload size is zero
				if (payloadSize === 0) {
					if (writeIndex - readIndex < FRAME_HEADER_LENGTH) {
						break;
					}
				} else {
					while (writeIndex - readIndex < payloadSize) {
						const { done, value } = await (deadline
							? deadline.executeWithinDeadline(async () => await reader.read(), abortController)
							: await reader.read());

						if (done) {
							stopRequested = true;
						}

						if (value !== undefined) {
							if (writeIndex + value.length > buffer.length) {
								const newBuffer = new Uint8Array(buffer.length + value.length);
								newBuffer.set(buffer);
								buffer = newBuffer;
							}
							buffer.set(value, writeIndex);
							writeIndex += value.length;
						}
					}
					yield decoder(buffer.subarray(readIndex, readIndex + payloadSize));
					readIndex += payloadSize;
				}
			}

			if (done && writeIndex - readIndex !== 0) {
				throw new TempoError(
					TempoStatusCode.DATA_LOSS,
					`Stream ended in the middle of a Tempo stream frame; ${writeIndex - readIndex} bytes of data were lost`,
				);
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Writes data from an asynchronous generator to a writable stream using a specified encoder.
 * @template TRecord - The type of the records generated by the generator.
 * @param {WritableStream<Uint8Array>} stream - The writable stream to write the data to.
 * @param {AsyncGenerator<TRecord, void, undefined> | undefined} recordGenerator - The asynchronous generator function that produces the records.
 * @param {(payload: TRecord) => Uint8Array} encoder - The function that encodes a record into a Uint8Array payload.
 * @returns {Promise<void>} - A Promise that resolves when all records have been written to the stream.
 */
export async function writeTempoStream<TRecord extends BebopRecord>(
	stream: WritableStream<Uint8Array>,
	recordGenerator: AsyncGenerator<TRecord, void, undefined> | undefined,
	encoder: (payload: TRecord) => Uint8Array,
	deadline?: Deadline,
	abortController?: AbortController,
): Promise<void> {
	const writer = stream.getWriter();
	const streamId = generateStreamIdentifier();
	let writeIndex = 0; // keep track of where to write data
	if (recordGenerator === undefined) {
		throw new TempoError(TempoStatusCode.INVALID_ARGUMENT, 'record generator function is undefined');
	}
	try {
		let buffer = new Uint8Array(2048);
		const header = {
			length: 0,
			reserved: 0,
			flags: 0,
			streamIdentifier: streamId,
		};
		const writeFrame = async (payload: Uint8Array) => {
			if (writeIndex + FRAME_HEADER_LENGTH + payload.length > buffer.length) {
				const newBuffer = new Uint8Array(writeIndex + FRAME_HEADER_LENGTH + payload.length);
				newBuffer.set(buffer);
				buffer = newBuffer;
			}
			header.length = payload.length;
			writeFrameHeaderToBuffer(buffer, header, writeIndex);
			writeIndex += FRAME_HEADER_LENGTH;
			buffer.set(payload, writeIndex);
			writeIndex += payload.length;
			await writer.write(buffer.slice(0, writeIndex));
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
		header.flags = getFlag('END_STREAM');
		writeFrameHeaderToBuffer(buffer, header, writeIndex);
		await writer.write(buffer.slice(0, FRAME_HEADER_LENGTH));
		await writer.close();
	} finally {
		writer.releaseLock();
	}
}
