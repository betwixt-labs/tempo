import { TempoLogger } from '@tempojs/common';

/**
 * BaseService is an abstract class that provides the foundation for
 * implementing Tempo services. This class contains a logger, allowing subclasses
 * to log information using a consistent logger interface.
 *
 * @export
 * @abstract
 * @class BaseService
 */
export abstract class BaseService {
	/**
	 * The logger instance used to log information. This logger is
	 * provided by the TempoLogger interface, ensuring a consistent
	 * logging mechanism across all subclasses.
	 *
	 * @protected
	 * @readonly
	 * @type {TempoLogger}
	 * @memberof BaseService
	 */
	protected logger: TempoLogger;

	/**
	 * Creates an instance of BaseService.
	 *
	 * @constructor
	 * @param {TempoLogger} logger - The logger instance to be used
	 * by the service. It should implement the TempoLogger interface.
	 * @memberof BaseService
	 */
	constructor(logger: TempoLogger) {
		this.logger = logger;
	}

	public setLogger(logger: TempoLogger) {
		this.logger = logger;
	}
}
