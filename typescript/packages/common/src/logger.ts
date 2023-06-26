import { TempoError } from './error';
import { TempoStatusCode } from './status';

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
 * Abstract class representing a logger that can be used to log messages with different severity levels.
 */
export abstract class TempoLogger {
	/**
	 * Set of instances of `TempoLogger` globally in the application.
	 */
	protected static readonly instances: Map<string, TempoLogger> = new Map<string, TempoLogger>();

	/**
	 * Set of child loggers of this logger instance.
	 */
	protected readonly children: Set<TempoLogger> = new Set<TempoLogger>();

	/**
	 * The parent logger of this logger instance.
	 */
	protected parent?: TempoLogger | undefined;

	/**
	 * Creates an instance of `TempoLogger`.
	 *
	 * @param {string} sourceName - The name of the source of the log messages.
	 * @param {TempoLogLevel} logLevel - The minimum log level to log.
	 * @param {TempoLogger} [parent] - Optional parent logger to inherit log level from.
	 */
	constructor(protected sourceName: string, public logLevel: TempoLogLevel, parent?: TempoLogger | undefined) {
		sourceName = sourceName.replace(/\s+/g, '_');
		this.parent = parent;
		if (TempoLogger.instances.has(sourceName)) {
			throw new TempoError(TempoStatusCode.INTERNAL, `A logger with the name '${sourceName}' already exists.`);
		}
		// Add the new instance to the collection
		TempoLogger.instances.set(sourceName, this);
	}

	/**
	 * Logs a message with a "trace" log level.
	 *
	 * @param {string} message - The message to log.
	 * @param {Record<string, unknown>} [data] - Optional structured data associated with the message.
	 * @param {Error} [error] - Optional error object to include with the log entry.
	 * @note some Javascript runtimes may also output the sequence of calls and asynchronous events leading to the current `trace` which are not on the call stack —
	 * to help identify the origin of the current event evaluation loop.
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
	 * Sets the log level for this logger and all of its child loggers.
	 * @param {TempoLogLevel} logLevel - The new log level to set.
	 * @returns {void}
	 */
	public setLogLevel(logLevel: TempoLogLevel): void {
		this.logLevel = logLevel;
		if (this.children.size > 0) {
			for (const child of this.children) {
				child.setLogLevel(logLevel);
			}
		}
	}

	/**
	 * Creates a new instance of the logger with the same configuration as the current logger.
	 * The new logger will have the specified `sourceName` and the same log level as the current logger.
	 * If `asOrphan` is `false`, the new logger will be a child of the current logger.
	 *
	 * @param {string} sourceName - The name of the new logger.
	 * @param {boolean} [asOrphan=true] - Whether the new logger should be a child of the current logger.
	 * @returns {TLogger} - A new instance of the logger with the same configuration as the current logger.
	 */
	public clone<TLogger extends TempoLogger>(sourceName: string, asOrphan?: boolean): TLogger {
		const newLogger = Reflect.construct(this.constructor, [
			sourceName,
			this.logLevel,
			asOrphan !== true ? this : undefined,
		]) as TLogger;
		if (asOrphan !== true) {
			this.children.add(newLogger);
		}
		return newLogger;
	}

	/**
	 * Sets the global log level for all instances of the `TempoLogger` class.
	 * This method updates the log level for all root loggers, which in turn updates
	 * the log level for their children loggers.
	 *
	 * @param {TempoLogLevel} logLevel - The minimum log level for messages to be logged.
	 */
	public static setGlobalLogLevel(logLevel: TempoLogLevel): void {
		for (const logger of this.instances.values()) {
			// Only update the log level for root loggers. They will update their children.
			if (!logger.parent) {
				logger.setLogLevel(logLevel);
			}
		}
	}

	/**
	 * Sets the log level for a specific logger instance identified by its `sourceName`.
	 * This method updates the log level for the specified logger and all of its child loggers.
	 *
	 * @param {string} sourceName - The name of the logger instance to update.
	 * @param {TempoLogLevel} logLevel - The new log level to set.
	 * @returns {void}
	 */
	public static setSourceLogLevel(sourceName: string, logLevel: TempoLogLevel): void {
		const logger = this.instances.get(sourceName);
		if (logger !== undefined) {
			logger.setLogLevel(logLevel);
		}
	}
}

/**
 * The `ConsoleLogger` class provides an implementation of the `TempoLogger`
 * abstract class that logs messages with different log levels, structured data,
 * and optional error objects to the browser or Node.js console.
 *
 * @example
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
				console.trace(`[${this.sourceName}][trace] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Debug:
				console.debug(`[${this.sourceName}][debug] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Info:
				console.info(`[${this.sourceName}][info] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Warn:
				console.warn(`[${this.sourceName}][warn] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Error:
				console.error(`[${this.sourceName}][error] ${message} ${logData}${logError}`.trim());
				break;
			case TempoLogLevel.Critical:
				console.error(`[${this.sourceName}][critical] ${message} ${logData}${logError}`.trim());
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
