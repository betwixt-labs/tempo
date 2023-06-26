import { ConsoleLogger, TempoLogLevel, TempoLogger } from './logger'; // adjust import based on your file structure
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ConsoleLogger', () => {
	let consoleWarnSpy: any;
	let consoleErrorSpy: any;
	let consoleDebugSpy: any;
	let consoleTraceSpy: any;
	let consoleInfoSpy: any;

	beforeEach(() => {
		consoleTraceSpy = vi.spyOn(console, 'trace');
		consoleDebugSpy = vi.spyOn(console, 'debug');
		consoleInfoSpy = vi.spyOn(console, 'info');
		consoleWarnSpy = vi.spyOn(console, 'warn');
		consoleErrorSpy = vi.spyOn(console, 'error');
	});

	afterEach(() => {
		consoleTraceSpy.mockReset();
		consoleDebugSpy.mockReset();
		consoleInfoSpy.mockReset();
		consoleWarnSpy.mockReset();
		consoleErrorSpy.mockReset();
	});

	it('logs with different log levels', async () => {
		const logger = new ConsoleLogger('test', TempoLogLevel.Trace);

		logger.trace('trace message');
		logger.debug('debug message');
		logger.info('info message');
		logger.warn('warn message');
		logger.error('error message');
		logger.critical('critical message');

		expect(consoleTraceSpy.mock.calls.length).toBe(1);
		expect(consoleDebugSpy.mock.calls.length).toBe(1);
		expect(consoleInfoSpy.mock.calls.length).toBe(1);
		expect(consoleWarnSpy.mock.calls.length).toBe(1);
		expect(consoleErrorSpy.mock.calls.length).toBe(3); // both error and critical use console.error, and .trace causes a console.error here
	});

	it('should set global log level', () => {
		const logger1 = new ConsoleLogger('root1', TempoLogLevel.Debug);
		const logger2 = new ConsoleLogger('root2', TempoLogLevel.Error);
		const logger3 = logger2.clone('child1');

		// Assert the initial log level of the loggers
		expect(logger1.logLevel).toBe(TempoLogLevel.Debug);
		expect(logger2.logLevel).toBe(TempoLogLevel.Error);
		expect(logger3.logLevel).toBe(TempoLogLevel.Error);

		// Set the global log level
		TempoLogger.setGlobalLogLevel(TempoLogLevel.Info);

		// Assert that log level of the loggers changed globally
		expect(logger1.logLevel).toBe(TempoLogLevel.Info);
		expect(logger2.logLevel).toBe(TempoLogLevel.Info);
		expect(logger3.logLevel).toBe(TempoLogLevel.Info);
	});

	it('should set the log level for a specific source', () => {
		const logger1 = new ConsoleLogger('target', TempoLogLevel.Debug);
		const logger2 = logger1.clone('target_child');
		expect(logger1.logLevel).toBe(TempoLogLevel.Debug);
		expect(logger2.logLevel).toBe(TempoLogLevel.Debug);

		TempoLogger.setSourceLogLevel('target', TempoLogLevel.Info);
		expect(logger1.logLevel).toBe(TempoLogLevel.Info);
		expect(logger2.logLevel).toBe(TempoLogLevel.Info);
	});
});

describe('ConsoleLogger clone', () => {
	let consoleWarnSpy: any;
	let consoleErrorSpy: any;
	let consoleDebugSpy: any;
	let consoleTraceSpy: any;
	let consoleInfoSpy: any;

	beforeEach(() => {
		consoleTraceSpy = vi.spyOn(console, 'trace');
		consoleDebugSpy = vi.spyOn(console, 'debug');
		consoleInfoSpy = vi.spyOn(console, 'info');
		consoleWarnSpy = vi.spyOn(console, 'warn');
		consoleErrorSpy = vi.spyOn(console, 'error');
	});

	afterEach(() => {
		consoleTraceSpy.mockReset();
		consoleDebugSpy.mockReset();
		consoleInfoSpy.mockReset();
		consoleWarnSpy.mockReset();
		consoleErrorSpy.mockReset();
	});

	it('cloned logger logs with different log levels', async () => {
		const logger = new ConsoleLogger('clone_test_parent', TempoLogLevel.Trace);
		const clonedLogger: ConsoleLogger = logger.clone('clone_test_child');

		clonedLogger.trace('trace message');
		clonedLogger.debug('debug message');
		clonedLogger.info('info message');
		clonedLogger.warn('warn message');
		clonedLogger.error('error message');
		clonedLogger.critical('critical message');

		expect(consoleTraceSpy.mock.calls.length).toBe(1);
		expect(consoleDebugSpy.mock.calls.length).toBe(1);
		expect(consoleInfoSpy.mock.calls.length).toBe(1);
		expect(consoleWarnSpy.mock.calls.length).toBe(1);
		expect(consoleErrorSpy.mock.calls.length).toBe(2); // but trace doesn't raise here, so maybe an error happening in vitest prior to the test?
	});

	it('should clone and set log level for children', () => {
		const logger1 = new ConsoleLogger('bebop', TempoLogLevel.Debug);
		const logger2 = logger1.clone('is for the kids');
		expect(logger1.logLevel).toBe(TempoLogLevel.Debug);
		expect(logger2.logLevel).toBe(TempoLogLevel.Debug);

		logger1.setLogLevel(TempoLogLevel.Info);
		expect(logger1.logLevel).toBe(TempoLogLevel.Info);
		expect(logger2.logLevel).toBe(TempoLogLevel.Info);
	});
});
