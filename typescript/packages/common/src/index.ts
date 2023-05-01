import { TempoStatusCode } from './status';
import { TempoError } from './error';
import { Deadline } from './deadline';
import { TempoLogger, TempoLogLevel, ConsoleLogger } from './logger';
import { Metadata } from './metadata';
import { TimeSpan } from './timespan';
import { TempoUtil, ExecutionEnvironment } from './utils';
import { TempoVersion } from './version';
import {
	Credentials,
	parseCredentials,
	stringifyCredentials,
	CredentialPrimitiveValue,
	CredentialValue,
} from './credentials';

/**
 * Represents the possible content types used for encoding and decoding messages.
 */
export type TempoContentType = 'bebop' | 'json';

export {
	TempoStatusCode,
	TempoError,
	Deadline,
	TempoLogger,
	TempoLogLevel,
	ConsoleLogger,
	Metadata,
	TimeSpan,
	TempoUtil,
	Credentials,
	CredentialPrimitiveValue,
	CredentialValue,
	parseCredentials,
	stringifyCredentials,
	ExecutionEnvironment,
	TempoVersion,
};
