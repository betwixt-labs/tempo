import { ServerContext, IncomingContext, OutgoingContext } from './context';
import { AuthContext } from './auth';
import { Metadata, Deadline } from '@tempojs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { TempoError } from '@tempojs/common';

describe('ServerContext', () => {
	let incomingContext: IncomingContext;
	let outgoingContext: OutgoingContext;
	let authContext: AuthContext;
	let environment: unknown;

	beforeEach(() => {
		// mock the required objects
		incomingContext = { headers: new Headers(), metadata: new Metadata(), deadline: Deadline.after(1000, 'seconds') };
		outgoingContext = { metadata: new Metadata(), credential: { id: 2000 } };
		authContext = new AuthContext('testKey');
		authContext.addProperty('testKey', 'testName', 'testValue');
		environment = { envKey: 'envValue' };
	});

	it('should create an instance of ServerContext', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		expect(serverContext).toBeInstanceOf(ServerContext);
	});

	it('should return the environment object casted to the specified type', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		const env = serverContext.getEnvironment<{ envKey: string }>();
		expect(env).toEqual(environment);
	});

	it('should throw error when authContext is set to undefined', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		expect(() => {
			serverContext.authContext = undefined;
		}).toThrow(TempoError);
	});

	it('should retrieve the authContext of the incoming request', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		serverContext.authContext = authContext;
		expect(serverContext.authContext).toEqual(authContext);
	});

	it('should retrieve the client headers of the incoming request', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		expect(serverContext.clientHeaders).toEqual(incomingContext.headers);
	});

	it('should retrieve the client metadata of the incoming request', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		expect(serverContext.clientMetadata).toEqual(incomingContext.metadata);
	});

	it('should retrieve the client deadline of the incoming request', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		expect(serverContext.clientDeadline).toEqual(incomingContext.deadline);
	});

	it('should append a key-value pair to the outgoing context', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		serverContext.appendToOutgoingContext('testKey', 'testValue');
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		//@ts-ignore
		expect(serverContext.outgoingContext.metadata.getTextValues('testKey')).toEqual(['testValue']);
	});

	it('should throw error when outgoingCredential is set to undefined', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		expect(() => {
			serverContext.outgoingCredential = undefined;
		}).toThrow(TempoError);
	});

	it('should retrieve the outgoingCredential', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		expect(serverContext.outgoingCredential).toEqual(outgoingContext.credential);
	});

	it('should set a key-value pair in the outgoing context', () => {
		const serverContext = new ServerContext(incomingContext, outgoingContext, environment);
		serverContext.setToOutgoingContext('testKey', 'testValue');
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		//@ts-ignore
		expect(serverContext.outgoingContext.metadata.getTextValues('testKey')).toEqual(['testValue']);
	});
});
