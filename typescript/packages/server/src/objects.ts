import { TempoLogger } from '@tempojs/common';
import { Validator } from './validator';

const tagRegex = /[&<>"']/g;
const tagsToReplace: { [tag: string]: string } = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;',
};
const bodyBlackList = ['$'];

export class ObjectValidator extends Validator {
	/**
	 * Create an ObjectValidator instance
	 * @param {TempoLogger} logger - The logger instance
	 */
	constructor(logger: TempoLogger) {
		super('Object Validator', logger);
	}

	/**
	 * Check if the input is an array
	 * @param {*} input - The input to check
	 * @returns {boolean} - Returns true if input is an array, false otherwise
	 */
	isArray(input: any): boolean {
		return Array.isArray(input);
	}

	/**
	 * Sanitize the input object by removing forbidden characters and escaping HTML tags
	 * @param {{ [x: string]: any; }} obj - The input object to sanitize
	 * @returns {boolean} - Returns true if sanitization is successful, false otherwise
	 */
	sanitize(obj: { [x: string]: any }): boolean {
		this.logger.info(`starting sanitization`);

		/**
		 * Recursively filter the input object and remove forbidden characters
		 * @param {{ [x: string]: any }} obj - The input object to filter
		 * @param {string[]} blackList - The list of forbidden characters
		 * @returns {boolean} - Returns true if filtering is successful, false otherwise
		 */
		const filter = (obj: { [x: string]: any }, blackList: string[]): boolean => {
			let successful = true;
			for (const key of Object.keys(obj)) {
				let input = obj[key];
				if (!input) {
					successful = false;
					this.logger.info('no input value');
					break;
				}
				if (typeof input === 'string') {
					if (!key.toLowerCase().includes('password')) {
						for (let i = 0; i < blackList.length; i++) {
							if (input.indexOf(blackList[i]!.toLowerCase()) !== -1) {
								successful = false;
								break;
							}
						}
						if (!successful) {
							break;
						}
					}
					input = input.replace(tagRegex, (tag: string) => tagsToReplace[tag] || tag).trim();
					if (!input) {
						successful = false;
						break;
					}
					// replace the original string value with our sanitized one
					obj[key] = input;
				}
				if (typeof obj[key] === 'object') {
					successful = filter(obj[key], blackList);
					if (!successful) {
						break;
					}
				}
			}
			return successful;
		};

		return filter(obj, bodyBlackList);
	}
}
