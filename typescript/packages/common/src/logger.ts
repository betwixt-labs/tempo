/**
 * Defines logging severity levels.
 */
export enum TempoLogLevel {
	/**
	 * Logs that contain the most detailed messages.
	 * These messages may contain sensitive application data.
	 * These messages are disabled by default and should never be enabled in a production environment.
	 */
	Trace = 0,
	/**
	 * Logs that are used for interactive investigation during development.
	 * These logs should primarily contain information useful for debugging and have no long-term value.
	 */
	Debug = 1,
	/**
	 * Logs that track the general flow of the application.
	 * These logs should have long-term value.
	 */
	Info = 2,
	/**
	 * Logs that highlight an abnormal or unexpected event in the application flow,
	 * but do not otherwise cause the application execution to stop.
	 */
	Warn = 3,
	/**
	 * Logs that highlight when the current flow of execution is stopped due to a failure.
	 * These should indicate a failure in the current activity, not an application-wide failure.
	 */
	Error = 4,
	/**
	 * Logs that describe an unrecoverable application or system crash,
	 * or a catastrophic failure that requires immediate attention.
	 */
	Critical = 5,
	/**
	 * Not used for writing log messages. Specifies that a logging category should not write any messages.
	 */
	None = 6,
}

/**
 * The `TempoLogger` represents a structured logging class for
 * Bebop. It defines the necessary methods for logging messages with various
 * log levels, structured data, and optional error objects.
 */
export abstract class TempoLogger {
	/**
	 * Constructs a new logger instance.
	 * @param sourceName - the name of the class or module that is logging messages.
	 * @param logLevel - the minimum log level for messages to be logged.
	 */
	constructor(protected sourceName: string, protected logLevel: TempoLogLevel) {
		sourceName = sourceName.toUpperCase().replaceAll(' ', '_');
	}

	/**
	 * Logs a message with a "trace" log level.
	 *
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 */
	abstract trace(message: string, data?: Record<string, unknown>, error?: Error): void;

	/**
	 * Logs a message with a "debug" log level.
	 *
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 */
	abstract debug(message: string, data?: Record<string, unknown>, error?: Error): void;

	/**
	 * Logs a message with an "info" log level.
	 *
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 */
	abstract info(message: string, data?: Record<string, unknown>, error?: Error): void;

	/**
	 * Logs a message with a "warn" log level.
	 *
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 */
	abstract warn(message: string, data?: Record<string, unknown>, error?: Error): void;

	/**
	 * Logs a message with an "error" log level.
	 *
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 */
	abstract error(message: string, data?: Record<string, unknown>, error?: Error): void;

	/**
	 * Logs a message with an "critical" log level.
	 *
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 */
	abstract critical(message: string, data?: Record<string, unknown>, error?: Error): void;

	/**
	 * Writes a custom message with a specific log level to the output.
	 *
	 * @param {TempoLogLevel} level - The log level for the message.
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 */
	abstract write(level: TempoLogLevel, message: string, data?: Record<string, unknown>, error?: Error): void;
	/**
	 * Sets the log level
	 * @param logLevel - the minimum log level for messages to be logged.
	 */
	public setLogLevel(logLevel: TempoLogLevel): void {
		this.logLevel = logLevel;
	}

	/**
	 * Clones the logger with a new source name
	 * @param sourceName - the source name to use for the cloned logger
	 * @returns a new logger instance with the same log level as the current logger
	 */
	public clone<TLogger extends TempoLogger>(sourceName: string): TLogger {
		return Reflect.construct(this.constructor, [sourceName, this.logLevel]);
	}
}

/**
 * The `ConsoleLogger` class provides an implementation of the `TempoLogger`
 * abstract class that logs messages with different log levels, structured data,
 * and optional error objects to the browser or Node.js console.
 *
 * Example usage:
 * ```
 * const logger = new ConsoleLogger();
 * logger.debug('Debug message');
 * logger.info('Info message', { key: 'value' });
 * logger.warn('Warning message', undefined, new Error('Warning error'));
 * logger.error('Error message', { key: 'value' }, new Error('Error details'));
 * ```
 */
export class ConsoleLogger extends TempoLogger {
	constructor(sourceName: string, logLevel: TempoLogLevel = TempoLogLevel.Debug) {
		super(sourceName, logLevel);
	}

	/**
	 * @inheritDoc
	 */
	trace(message: string, data?: Record<string, unknown>, error?: Error): void {
		this.write(TempoLogLevel.Trace, message, data, error);
	}

	/**
	 * @inheritDoc
	 */
	debug(message: string, data?: Record<string, unknown>, error?: Error): void {
		this.write(TempoLogLevel.Debug, message, data, error);
	}
	/**
	 * @inheritDoc
	 */
	info(message: string, data?: Record<string, unknown>, error?: Error): void {
		this.write(TempoLogLevel.Info, message, data, error);
	}
	/**
	 * @inheritDoc
	 */
	warn(message: string, data?: Record<string, unknown>, error?: Error): void {
		this.write(TempoLogLevel.Warn, message, data, error);
	}
	/**
	 * @inheritDoc
	 */
	error(message: string, data?: Record<string, unknown>, error?: Error): void {
		this.write(TempoLogLevel.Error, message, data, error);
	}

	/**
	 * @inheritDoc
	 */
	critical(message: string, data?: Record<string, unknown>, error?: Error): void {
		this.write(TempoLogLevel.Critical, message, data, error);
	}

	/**
	 * @inheritDoc
	 */
	write(level: TempoLogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
		if (level < this.logLevel) {
			return;
		}
		const logData = data ? JSON.stringify(data) : '';
		let logError = '';

		if (error) {
			const stack = this.formatErrorMessage(error);
			logError = `\n${stack}`;
		}

		switch (level) {
			case TempoLogLevel.Trace:
				console.trace(`[${this.sourceName}][TRACE] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Debug:
				console.debug(`[${this.sourceName}][DEBUG] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Info:
				console.info(`[${this.sourceName}][INFO] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Warn:
				console.warn(`[${this.sourceName}][WARN] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Error:
				console.error(`[${this.sourceName}][ERROR] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Critical:
				console.error(`[${this.sourceName}][CRITICAL] ${message} ${logData}${logError}`.trim());
				break;
		}
	}

	formatErrorMessage(error: Error, indentLevel = 0): string {
		const indent = '  '.repeat(indentLevel);
		const message = error.message || 'Unknown error';
		const stack = error.stack || 'Stack unavailable';
		const indentedStack = stack
			.split('\n')
			.map((line) => `${indent}${line}`)
			.join('\n');
		let cause = '';
		if ('cause' in error) {
			cause = error?.cause instanceof Error ? this.formatErrorMessage(error.cause, indentLevel + 1) : '';
		}
		return `\n${indent}Error message: ${message}\n${indentedStack}\n${indent}${
			cause ? `Cause: ${cause}` : ''
		}`.trimEnd();
	}
}
