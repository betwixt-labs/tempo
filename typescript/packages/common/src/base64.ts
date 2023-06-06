// prettier-ignore
const base64Table = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/'
];
// prettier-ignore
const lookup = new Uint8Array([
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 62, 0, 62, 0, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8,
	9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 0, 0, 0, 0, 63, 0, 26, 27, 28, 29, 30, 31, 32, 33,
	34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
]);

/**
 * Encodes a given Uint8Array into a Base64 string.
 *
 * @param input The Uint8Array to encode.
 * @returns The Base64-encoded string.
 */
const encode = (input: Uint8Array): string => {
	// Initialize an empty string to build the output Base64-encoded string.
	let output = '';
	// Initialize a variable to count how many padding characters ('=') we'll need to add to the end of the encoded string.
	let padding = 0;

	// Loop over each byte in the input array, incrementing by 3 each time. Base64 encoding works on 3 bytes at a time.
	for (let i = 0; i < input.length; i += 3) {
		// Combine three bytes into a single 24-bit number. Shifts each byte to its correct position in the combined value.
		// If the byte is not present (beyond the length of the input), NaN will be returned.
		const combined = (input[i]! << 16) | (input[i + 1]! << 8) | input[i + 2]!;

		// If the second byte is not present, increment the padding counter.
		if (isNaN(input[i + 1]!)) padding++;
		// If the third byte is not present, increment the padding counter.
		if (isNaN(input[i + 2]!)) padding++;

		// Add the Base64 encoding of the 24-bit number to the output string. The 24-bit number is divided into four 6-bit numbers.
		// Each 6-bit number is used as an index into the Base64 table to get the corresponding character.
		output +=
			base64Table[(combined >> 18) & 63]! +
			base64Table[(combined >> 12) & 63]! +
			base64Table[(combined >> 6) & 63] +
			base64Table[combined & 63];
	}
	// Return the output string, but remove as many characters from the end as there are padding characters needed, then add the appropriate number of '=' characters.
	// If two padding characters are needed, add '=='. If one is needed, add '='. If none are needed, add nothing.
	return output.slice(0, output.length - padding) + (padding === 2 ? '==' : padding === 1 ? '=' : '');
};

/**
 * Decodes a given Base64 string into a Uint8Array.
 * @param input The Base64 string to decode.
 * @returns The decoded Uint8Array.
 */
const decode = (input: string): Uint8Array => {
	// Length of the input string.
	const sourceLength = input.length;
	// Determine the number of padding characters in the input by checking the last two characters.
	const paddingLength = input[sourceLength - 2] === '=' ? 2 : input[sourceLength - 1] === '=' ? 1 : 0;
	// Determine the length of the input that contains the base64 characters, excluding padding.
	const baseLength = (sourceLength - paddingLength) & 0xfffffffc;
	// Initialize a Uint8Array to hold the decoded output.
	const output = new Uint8Array((sourceLength / 4) * 3 - paddingLength);
	// Temporary variable for intermediate computations.
	let tmp;
	// Iteration variable for the main loop.
	let i = 0;
	// Byte index counter for the output array.
	let byteIndex = 0;

	// Iterate over the base64 characters in the input, four at a time. 
	for (; i < baseLength; i += 4) {
		// Decode four base64 characters into a 24-bit number. The `lookup` array maps ASCII character codes to their base64 values.
		tmp =
			(lookup[input.charCodeAt(i)]! << 18) |
			(lookup[input.charCodeAt(i + 1)]! << 12) |
			(lookup[input.charCodeAt(i + 2)]! << 6) |
			lookup[input.charCodeAt(i + 3)]!;
		// Split the 24-bit number into three 8-bit bytes and add them to the output.
		output[byteIndex++] = (tmp >> 16) & 0xff;
		output[byteIndex++] = (tmp >> 8) & 0xff;
		output[byteIndex++] = tmp & 0xff;
	}

	// If there's one padding character, decode the remaining two base64 characters into two bytes.
	if (paddingLength === 1) {
		tmp =
			(lookup[input.charCodeAt(i)]! << 10) |
			(lookup[input.charCodeAt(i + 1)]! << 4) |
			(lookup[input.charCodeAt(i + 2)]! >> 2);
		output[byteIndex++] = (tmp >> 8) & 0xff;
		output[byteIndex++] = tmp & 0xff;
	}

	// If there's two padding characters, decode the remaining base64 character into one byte.
	if (paddingLength === 2) {
		tmp = (lookup[input.charCodeAt(i)]! << 2) | (lookup[input.charCodeAt(i + 1)]! >> 4);
		output[byteIndex++] = tmp & 0xff;
	}

	// Return the output array.
	return output;
};

/**
 * A collection of Base64 encoding and decoding functions.
 */
export const Base64 = {
	encode,
	decode,
};
