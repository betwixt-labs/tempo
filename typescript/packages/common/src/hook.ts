import { BebopRecord } from 'bebop';

/**
 * Represents the name of a hook.
 */
type HookType = 'request' | 'response' | 'decode' | 'error';

/**
 * Represents a hook that is executed when a request is sent or received.
 * @template TContext - The type of the context parameter.
 * @template TEnvironment - The type of the environment parameter.
 * @param {TContext} context - The context object.
 * @param {TEnvironment} environment - The environment object.
 * @param {RequestHook<TContext, TEnvironment>} next - The next hook in the chain.
 * @returns {void | Promise<void>} - A void value or a promise resolving to void.
 */
type RequestHook<TContext, TEnvironment> = (
	context: TContext,
	environment: TEnvironment,
	next: () => void | Promise<void>,
) => void | Promise<void>;

/**
 * Represents a hook that is executed when a response is sent or received.
 * @template TContext - The type of the context parameter.
 * @template TEnvironment - The type of the environment parameter.
 * @param {TContext} context - The context object.
 * @param {TEnvironment} environment - The environment object.
 * @param {ResponseHook<TContext, TEnvironment>} next - The next hook in the chain.
 * @returns {void | Promise<void>} - A void value or a promise resolving to void.
 */
type ResponseHook<TContext, TEnvironment> = (
	context: TContext,
	environment: TEnvironment,
	next: () => void | Promise<void>,
) => void | Promise<void>;

/**
 * Represents a hook that is executed when a request or response payload is decoded.
 * @template TContext - The type of the context parameter.
 * @template TEnvironment - The type of the environment parameter.
 * @param {TContext} context - The context object.
 * @param {TEnvironment} environment - The environment object.
 * @param {BebopRecord} record - The Bebop record being decoded.
 * @param {DecodeHook<TContext, TEnvironment>} next - The next hook in the chain.
 * @returns {void | Promise<void>} - A void value or a promise resolving to void.
 */
type DecodeHook<TContext, TEnvironment> = (
	context: TContext,
	environment: TEnvironment,
	record: BebopRecord,
	next: () => void | Promise<void>,
) => void | Promise<void>;

/**
 * Represents a hook that is executed when an error occurs.
 * @template TContext - The type of the context parameter.
 * @template TEnvironment - The type of the environment parameter.
 * @param {TContext} context - The context object.
 * @param {TEnvironment} environment - The environment object.
 * @param {Error} error - The error that occurred.
 * @param {ErrorHook<TContext, TEnvironment>} next - The next hook in the chain.
 * @returns {void | Promise<void>} - A void value or a promise resolving to void.
 */
type ErrorHook<TContext, TEnvironment> = (
	context: TContext | undefined,
	environment: TEnvironment,
	error: Error,
	next: () => void | Promise<void>,
) => void | Promise<void>;

/**
 * Represents a hook that can be registered with the `HookRegistry`.
 */
type Hook<TContext, TEnvironment> =
	| RequestHook<TContext, TEnvironment>
	| ResponseHook<TContext, TEnvironment>
	| DecodeHook<TContext, TEnvironment>
	| ErrorHook<TContext, TEnvironment>;

/**
 * Represents the parameter type for a specific hook type.
 */
type HookParam<T extends HookType, TContext, TEnvironment> = T extends 'request'
	? RequestHook<TContext, TEnvironment>
	: T extends 'response'
	? ResponseHook<TContext, TEnvironment>
	: T extends 'decode'
	? DecodeHook<TContext, TEnvironment>
	: T extends 'error'
	? ErrorHook<TContext, TEnvironment>
	: never;

/**
 * Represents a registry for registering and executing different types of hooks.
 */
export class HookRegistry<TContext, TEnvironment> {
	private readonly hooks: Map<HookType, Array<Hook<TContext, TEnvironment>>>;
	private readonly environment: TEnvironment;

	/**
	 * Creates an instance of HookRegistry.
	 * @param {TEnvironment} environment - The environment object to be passed to the hooks.
	 */
	constructor(environment: TEnvironment) {
		this.environment = environment;
		this.hooks = new Map();
	}

	/**
	 * Registers a hook of the specified type.
	 * @param {HookType} hookType - The type of the hook.
	 * @param {HookParam} hook - The hook function to register.
	 */
	public registerHook<T extends HookType>(hookType: T, hook: HookParam<T, TContext, TEnvironment>): void {
		const existingHooks = this.hooks.get(hookType) ?? [];
		existingHooks.push(hook);
		this.hooks.set(hookType, existingHooks);
	}

	/**
	 * Executes registered request hooks.
	 * @param {TContext} context - The context object to pass to the hooks.
	 * @returns {Promise<void>}
	 */
	public async executeRequestHooks(context: TContext): Promise<void> {
		await this.executeHooks('request', context);
	}

	/**
	 * Executes registered response hooks.
	 * @param {TContext} context - The context object to pass to the hooks.
	 * @returns {Promise<void>}
	 */
	public async executeResponseHooks(context: TContext): Promise<void> {
		await this.executeHooks('response', context);
	}

	/**
	 * Executes registered decode hooks.
	 * @param {TContext} context - The context object to pass to the hooks.
	 * @param {BebopRecord} record - The Bebop record to pass to the decode hooks.
	 * @returns {Promise<void>}
	 */
	public async executeDecodeHooks(context: TContext, record: BebopRecord): Promise<void> {
		await this.executeHooks('decode', context, record);
	}

	/**
	 * Executes registered error hooks.
	 * @param {TContext} context - The context object to pass to the hooks.
	 * @param {Error} error - The error object to pass to the error hooks.
	 * @returns {Promise<void>}
	 */
	public async executeErrorHooks(context: TContext | undefined, error: Error): Promise<void> {
		await this.executeHooks('error', context, undefined, error);
	}

	/**
	 * Executes the chain of hooks for the specified hook type.
	 * @param {HookType} hookType - The type of the hook to execute.
	 * @param {TContext} context - The context object to pass to the hooks.
	 * @param {BebopRecord | undefined} record - The Bebop record to pass to the decode hooks (only applicable for 'decode' hook type).
	 * @param {Error | undefined} error - The error object to pass to the error hooks (only applicable for 'error' hook type).
	 * @returns {Promise<void>}
	 */
	private async executeHooks<T extends HookType>(
		hookType: T,
		context: TContext | undefined,
		record: BebopRecord | undefined = undefined,
		error: Error | undefined = undefined,
	): Promise<void> {
		const hooks = this.hooks.get(hookType);
		if (hooks === undefined) {
			return;
		}
		const executeNextHook = async (currentIndex: number): Promise<void> => {
			const currentHook = hooks[currentIndex];
			if (currentHook !== undefined) {
				const next = async (): Promise<void> => {
					await executeNextHook(currentIndex + 1);
				};
				if (this.isDecodeHook(hookType, currentHook) && record !== undefined && context !== undefined) {
					await currentHook(context, this.environment, record, next);
				} else if (this.isErrorHook(hookType, currentHook) && error !== undefined) {
					await currentHook(context, this.environment, error, next);
				} else if (this.isRequestHook(hookType, currentHook) && context !== undefined) {
					await currentHook(context, this.environment, next);
				} else if (this.isResponseHook(hookType, currentHook) && context !== undefined) {
					await currentHook(context, this.environment, next);
				}
			}
		};
		await executeNextHook(0);
	}

	// helpers
	private isDecodeHook(
		hookType: HookType,
		_hook: Hook<TContext, TEnvironment>,
	): _hook is DecodeHook<TContext, TEnvironment> {
		return hookType === 'decode';
	}

	private isErrorHook(
		hookType: HookType,
		_hook: Hook<TContext, TEnvironment>,
	): _hook is ErrorHook<TContext, TEnvironment> {
		return hookType === 'error';
	}

	private isRequestHook(
		hookType: HookType,
		_hook: Hook<TContext, TEnvironment>,
	): _hook is RequestHook<TContext, TEnvironment> {
		return hookType === 'request';
	}

	private isResponseHook(
		hookType: HookType,
		_hook: Hook<TContext, TEnvironment>,
	): _hook is ResponseHook<TContext, TEnvironment> {
		return hookType === 'response';
	}
}
