import { TempoLogger } from '@tempojs/common';
import { Validator } from './validator';
export declare class ObjectValidator extends Validator {
	/**
	 * Create an ObjectValidator instance
	 * @param {TempoLogger} logger - The logger instance
	 */
	constructor(logger: TempoLogger);
	/**
	 * Check if the input is an array
	 * @param {*} input - The input to check
	 * @returns {boolean} - Returns true if input is an array, false otherwise
	 */
	isArray(input: any): boolean;
	/**
	 * Sanitize the input object by removing forbidden characters and escaping HTML tags
	 * @param {{ [x: string]: any; }} obj - The input object to sanitize
	 * @returns {boolean} - Returns true if sanitization is successful, false otherwise
	 */
	sanitize(obj: { [x: string]: any }): boolean;
}
