import { describe, it, expect } from 'vitest';
import { HookRegistry } from './hook';

describe('HookRegistry', () => {
	it('should execute request hooks', async () => {
		type RequestContext = {
			some: string;
		};
		const registry = new HookRegistry<RequestContext, string>('');
		registry.registerHook('request', async (context, _env, next) => {
			context.some = 'first';
			return await next();
		});
		registry.registerHook('request', async (context, _env, next) => {
			context.some += 'second';
			return await next();
		});
		registry.registerHook('request', async (context, _env, next) => {
			context.some += 'third';
			return await next();
		});
		const context: RequestContext = {
			some: '',
		};
		await registry.executeRequestHooks(context);
		expect(context.some).toEqual('firstsecondthird');
	});
	it('should execute decode hooks', async () => {
		type DecodeContext = {
			some: string;
		};
		const registry = new HookRegistry<DecodeContext, string>('');
		registry.registerHook('decode', async (_context, _env, record, next) => {
			(record as any).data = 'first';
			return await next();
		});
		registry.registerHook('decode', async (_context, _env, record, next) => {
			(record as any).data += 'second';
			return await next();
		});
		registry.registerHook('decode', async (_context, _env, record, next) => {
			(record as any).data += 'third';
			return await next();
		});
		const context: DecodeContext = {
			some: '',
		};
		const record = {
			data: '',
		};
		await registry.executeDecodeHooks(context, record);
		expect(record.data).toEqual('firstsecondthird');
	});
	it('should execute response hooks', async () => {
		type ResponseContext = {
			some: string;
		};
		const registry = new HookRegistry<ResponseContext, string>('');
		registry.registerHook('response', async (context, _env, next) => {
			context.some = 'first';
			return await next();
		});
		registry.registerHook('response', async (context, _env, next) => {
			context.some += 'second';
			return await next();
		});
		registry.registerHook('response', async (context, _env, next) => {
			context.some += 'third';
			return await next();
		});
		const context: ResponseContext = {
			some: '',
		};
		await registry.executeResponseHooks(context);
		expect(context.some).toEqual('firstsecondthird');
	});
	it('should execute error hooks', async () => {
		type ErrorContext = {
			some: string;
		};
		const registry = new HookRegistry<ErrorContext, string>('');
		registry.registerHook('error', async (_context, _env, error, next) => {
			error.message = 'first';
			return await next();
		});
		registry.registerHook('error', async (_context, _env, error, next) => {
			error.message += 'second';
			return await next();
		});
		registry.registerHook('error', async (_context, _env, error, next) => {
			error.message += 'third';
			return await next();
		});
		const context: ErrorContext = {
			some: '',
		};
		const error = new Error();
		await registry.executeErrorHooks(context, error);
		expect(error.message).toEqual('firstsecondthird');
	});
	it('should shortcircuit hooks', async () => {
		type RequestContext = {
			some: string;
		};
		const registry = new HookRegistry<RequestContext, string>('');
		registry.registerHook('request', async (context, _env, next) => {
			context.some = 'first';
			return await next();
		});
		registry.registerHook('request', async (context) => {
			context.some += 'second';
		});
		registry.registerHook('request', async (context) => {
			context.some += 'third';
		});
		const context: RequestContext = {
			some: '',
		};
		await registry.executeRequestHooks(context);
		expect(context.some).toEqual('firstsecond');
	});

	it('should execute all hooks', async () => {
		type Context = {
			some: string;
		};
		const registry = new HookRegistry<Context, string>('');
		registry.registerHook('request', async (context, _env, next) => {
			context.some = 'first';
			return await next();
		});
		registry.registerHook('decode', async (context, _env, _record, next) => {
			context.some += 'second';
			return await next();
		});
		registry.registerHook('response', async (context, _env, next) => {
			context.some += 'third';
			return await next();
		});
		registry.registerHook('error', async (context, _env, _error, next) => {
			context!.some += 'fourth';
			return await next();
		});

		const context: Context = {
			some: '',
		};
		const record = {
			data: '',
		};
		const error = new Error();
		await registry.executeRequestHooks(context);
		await registry.executeDecodeHooks(context, record);
		await registry.executeResponseHooks(context);
		await registry.executeErrorHooks(context, error);
		expect(context.some).toEqual('firstsecondthirdfourth');
	});
});
