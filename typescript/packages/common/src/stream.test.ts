import { expect, it, describe } from 'vitest';
import {
	TempoFrameHeader,
	generateStreamIdentifier,
	getFlag,
	readFrameHeaderFromBuffer,
	readTempoStream,
	writeFrameHeaderToBuffer,
	writeTempoStream,
} from './stream';
import { TempoUtil } from './utils';

// Test readFrameHeaderFromBuffer
describe('readFrameHeaderFromBuffer', () => {
	it('should read a valid frame header from the buffer', () => {
		const expectedHeader: TempoFrameHeader = {
			length: 291,
			reserved: 0x00,
			flags: 0xff,
			streamIdentifier: 0x123456,
		};
		const buffer = new Uint8Array(9);
		writeFrameHeaderToBuffer(buffer, expectedHeader, 0);
		const header = readFrameHeaderFromBuffer(buffer, 0);
		expect(header).toEqual(expectedHeader);
	});

	it('should throw an error for a buffer with less than 9 bytes', () => {
		const buffer = new Uint8Array([0x01, 0x23]);
		expect(() => readFrameHeaderFromBuffer(buffer, 0)).toThrow();
	});

	it('should throw an error for an invalid header value', () => {
		const buffer = new Uint8Array([
			0x01,
			0x23,
			0x45, // length: 1193045 (out of range)
			0x00, // reserved
			0xff, // flags
			0x12,
			0x34,
			0x56, // streamIdentifier
		]);
		expect(() => readFrameHeaderFromBuffer(buffer, 0)).toThrow();
	});
});

// Test writeFrameHeaderToBuffer
describe('writeFrameHeaderToBuffer', () => {
	it('should write a valid frame header to the buffer', () => {
		const buffer = new Uint8Array(9);
		const header: TempoFrameHeader = {
			length: 291,
			reserved: 0x00,
			flags: 0xff,
			streamIdentifier: 0x123456,
		};
		writeFrameHeaderToBuffer(buffer, header, 0);
		const expectedBuffer = new Uint8Array([
			0x00,
			0x01,
			0x23, // length: 291
			0x00, // reserved
			0xff, // flags
			0x00,
			0x12,
			0x34,
			0x56, // streamIdentifier
		]);
		expect(buffer).toEqual(expectedBuffer);
	});

	it('should throw an error for a buffer with less than 9 bytes', () => {
		const buffer = new Uint8Array([0x01, 0x23]);
		const header: TempoFrameHeader = {
			length: 291,
			reserved: 0x00,
			flags: 0xff,
			streamIdentifier: 0x123456,
		};
		expect(() => writeFrameHeaderToBuffer(buffer, header, 0)).toThrow();
	});

	// Add more tests for other scenarios
});

// Test generateStreamIdentifier
describe('generateStreamIdentifier', () => {
	it('should generate a random stream identifier within the valid range', () => {
		const streamId = generateStreamIdentifier();
		expect(streamId >= 1 && streamId <= Math.pow(2, 31) - 1).toBeTruthy();
	});
});

// Test getFlag
describe('getFlag', () => {
	it('should return the correct flag value for a given flag name', () => {
		const flagName = 'END_STREAM';
		const flagValue = getFlag(flagName);
		expect(flagValue).toEqual(0x1);
	});

	it('should return 0 for an unknown flag name', () => {
		const flagName = 'UNKNOWN_FLAG';
		const flagValue = getFlag(flagName);
		expect(flagValue).toEqual(0);
	});
});

// Mock decoder function
const mockDecoder = (buffer: Uint8Array): Promise<string> => {
	// Convert buffer to string for testing purposes
	return Promise.resolve(TempoUtil.utf8GetString(buffer));
};

// Helper function to create a ReadableStream with Uint8Array chunks
const createReadableStream = (chunks: Uint8Array[]): ReadableStream<Uint8Array> => {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			chunks.forEach((chunk) => {
				controller.enqueue(chunk);
			});
			controller.close();
		},
	});
};

// Test readStream

describe('readStream', () => {
	it('should read and yield decoded payloads from the stream', async () => {
		const header = {
			length: 5,
			reserved: 0x00,
			flags: 0x00,
			streamIdentifier: 0x123456,
		};

		const payload1 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
		const payload2 = new Uint8Array([0x57, 0x6f, 0x72, 0x6c, 0x64]); // "World"
		const frame1Buffer = new Uint8Array(9);
		writeFrameHeaderToBuffer(frame1Buffer, header, 0);
		const frame1 = new Uint8Array(frame1Buffer.byteLength + payload1.byteLength + 2);
		frame1.set(new Uint8Array(frame1Buffer), 0);
		frame1.set(payload1, frame1Buffer.byteLength);

		const frame2Buffer = new Uint8Array(9);
		writeFrameHeaderToBuffer(frame2Buffer, header, 0);
		const frame2 = new Uint8Array(frame2Buffer.byteLength + payload2.byteLength + 2);
		frame2.set(new Uint8Array(frame2Buffer), 0);
		frame2.set(payload2, frame2Buffer.byteLength);

		const chunks = [frame1, frame2];
		const stream = createReadableStream(chunks);

		const decodedPayloads: string[] = [];
		for await (const payload of readTempoStream(stream, mockDecoder)) {
			decodedPayloads.push(payload);
		}
		expect(decodedPayloads).toEqual(['Hello', 'World']);
	});

	it('should read and yield decoded payloads from the stream (partial)', async () => {
		const header = {
			length: 5,
			reserved: 0x00,
			flags: 0x00,
			streamIdentifier: 0x123456,
		};

		const payload1 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
		const payload2 = new Uint8Array([0x57, 0x6f, 0x72, 0x6c, 0x64]); // "World"

		// Generate chunks for header and payload 1
		const frame1Chunks: Uint8Array[] = [];
		const frame1HeaderBuffer = new Uint8Array(9);
		writeFrameHeaderToBuffer(frame1HeaderBuffer, header, 0);
		for (const byte of new Uint8Array(frame1HeaderBuffer)) {
			frame1Chunks.push(new Uint8Array([byte]));
		}
		for (const byte of payload1) {
			frame1Chunks.push(new Uint8Array([byte]));
		}

		frame1Chunks.push(new Uint8Array([0x0d, 0x0a])); // CRLF

		// Generate chunks for header and payload 2
		const frame2Chunks: Uint8Array[] = [];
		const frame2HeaderBuffer = new Uint8Array(9);
		writeFrameHeaderToBuffer(frame2HeaderBuffer, header, 0);
		for (const byte of new Uint8Array(frame2HeaderBuffer)) {
			frame2Chunks.push(new Uint8Array([byte]));
		}
		for (const byte of payload2) {
			frame2Chunks.push(new Uint8Array([byte]));
		}
		frame2Chunks.push(new Uint8Array([0x0d, 0x0a])); // CRLF

		const stream = createReadableStream([...frame1Chunks, ...frame2Chunks]);

		const decodedPayloads: string[] = [];
		for await (const payload of readTempoStream(stream, mockDecoder)) {
			decodedPayloads.push(payload);
		}
		expect(decodedPayloads).toEqual(['Hello', 'World']);
	});
});

describe('writeStream', () => {
	it('should correctly write the stream', async () => {
		const mockRecord = { key: 'value' };
		async function* gen() {
			yield mockRecord;
		}
		const encoder = (record: typeof mockRecord) => {
			const encoder = new TextEncoder();
			return encoder.encode(JSON.stringify(record));
		};

		const writtenData: Uint8Array[] = [];
		const mockWriter = {
			write: (chunk: Uint8Array) => {
				writtenData.push(new Uint8Array(chunk));
				return Promise.resolve();
			},
			close: () => {
				// do nothing
			},
			releaseLock: () => {
				// do nothing
			},
		};

		const mockStream: WritableStream<Uint8Array> = {
			getWriter: () => mockWriter,
		} as WritableStream<Uint8Array>;

		await writeTempoStream(mockStream, gen(), encoder);

		// Validate data
		for (let i = 0; i < writtenData.length; i++) {
			const chunk = writtenData[i];

			if (chunk === undefined) throw new Error('Chunk is undefined');
			// Validate header
			const header = readFrameHeaderFromBuffer(chunk, 0);
			const payloadChunk = chunk.slice(9, chunk.length - 2);

			expect(header.length).toBe(payloadChunk.length);

			// Validate payload
			if (header.flags !== getFlag('END_STREAM')) {
				const payloadText = new TextDecoder().decode(payloadChunk);
				const payload = JSON.parse(payloadText);
				expect(payload).toEqual(mockRecord);
			}

			// Validate END_OF_STREAM frame
			if (header.flags === getFlag('END_STREAM')) {
				expect(header.length).toBe(0);
				expect(header.flags).toBe(getFlag('END_STREAM'));
			}
		}
	});
});

describe('TempoStream', () => {
	it('should correctly handle write/read interaction', async () => {
		const mockRecord1 = { key: 'value1' };
		const mockRecord2 = { key: 'value2' };

		async function* gen() {
			yield mockRecord1;
			yield mockRecord2;
		}

		const encoder = (record: typeof mockRecord1 | typeof mockRecord2) => {
			const encoder = new TextEncoder();
			return encoder.encode(JSON.stringify(record));
		};

		const decoder = (data: Uint8Array) => {
			const decoder = new TextDecoder();
			return JSON.parse(decoder.decode(data));
		};

		const transformStream = new TransformStream<Uint8Array, Uint8Array>();

		// Start writing to the stream but don't await it
		writeTempoStream(transformStream.writable, gen(), encoder);

		// Now read the data back from the stream
		const readData: (typeof mockRecord1 | typeof mockRecord2)[] = [];

		for await (const payload of readTempoStream(transformStream.readable, decoder)) {
			readData.push(payload as typeof mockRecord1);
		}

		// Validate that we read back what we wrote
		expect(readData).toEqual([mockRecord1, mockRecord2]);
	});
});
