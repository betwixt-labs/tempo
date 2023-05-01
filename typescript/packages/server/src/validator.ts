import { TempoLogger } from '@tempojs/common';

/**
 * Represents an abstract base class for a validator that performs sanitization and checks on incoming requests.
 */
export abstract class Validator {
	/**
	 * The name of the validator.
	 */
	public name: string;

	/**
	 * The logger to use for logging validation-related information.
	 */
	protected logger: TempoLogger;

	/**
	 * Constructs a new Validator instance.
	 * @param name - The name of the validator.
	 * @param logger - The logger to use for logging validation-related information.
	 */
	constructor(name: string, logger: TempoLogger) {
		this.name = name;
		this.logger = logger.clone(name);
	}

	/**
	 * Displays the name of the validator using the logger instance.
	 */
	protected display(): void {
		this.logger.info(`xRPC Validator: ${this.name}`);
	}
}
