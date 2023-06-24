import { BaseChannel } from './channel';
import { ClientContext } from './context';
import { Credential } from '@tempojs/common';

/**
 * Type representing a class constructor for a class extending BaseClient.
 * This constructor type requires the class to have a prototype that extends BaseClient.
 */
// eslint-disable-next-line
export type ClientConstructor<T extends BaseClient> = Function & { prototype: T };

/**
 * Abstract class representing a base client.
 */
export abstract class BaseClient {
	protected context: ClientContext;
	/**
	 * Protected constructor for the BaseClient.
	 * @param {BaseChannel} channel - An instance of the channel class.
	 */
	protected constructor(protected readonly channel: BaseChannel) {
		this.context = ClientContext.createContext();
	}

	/**
	 * A static method to create an instance of a class extending BaseClient.
	 * @template TClient - The type of the client extending BaseClient.
	 * @param {ClientConstructor<TClient>} ctor - The constructor of the client extending BaseClient.
	 * @param {BaseChannel} channel - An instance of of a class extending BaseChannel class.
	 * @returns {TClient} - An instance of the specified client class.
	 */
	public static createInstance<TClient extends BaseClient>(
		ctor: ClientConstructor<TClient>,
		channel: BaseChannel,
	): TClient {
		return Reflect.construct(ctor, [channel]) as TClient;
	}

	/**
	 * Removes the current credential from the client storage.
	 */
	public async removeCredential(): Promise<void> {
		await this.channel.removeCredential();
	}

	/**
	 * Gets the current credential from the client storage.
	 * @returns {Promise<Credential | undefined>} - A promise that resolves with the current credential.
	 */
	public async getCredential(): Promise<Credential | undefined> {
		return await this.channel.getCredential();
	}

	public getContext(): ClientContext {
		return this.context;
	}
}
