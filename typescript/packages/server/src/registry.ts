import { TempoLogger } from '@tempojs/common';
import { BebopMethodAny } from './method';
import { BaseService } from './service';

/**
 * Represents an abstract base class for a service registry that manages services and methods in a Tempo application.
 */
export abstract class ServiceRegistry {
	/**
	 * A collection of service instances registered with the registry.
	 */
	protected readonly serviceInstances: BaseService[];

	/**
	 * A map of method IDs to their corresponding Tempo methods.
	 */
	protected readonly methods: Map<number, BebopMethodAny>;

	/**
	 * Constructs a new ServiceRegistry instance.
	 * @param logger - The logger to use for logging service registry-related information.
	 */
	constructor(protected readonly logger: TempoLogger) {
		this.serviceInstances = new Array<BaseService>();
		this.methods = new Map<number, BebopMethodAny>();
	}

	/**
	 * Initializes the ServiceRegistry with the required services and methods.
	 * This function should be called before using the registry.
	 *
	 * @example
	 * const registry = new ServiceRegistry();
	 * registry.init();
	 */
	public abstract init(): void;

	/**
	 * Returns the Tempo method corresponding to the provided ID.
	 *
	 * @param methodId - The unique identifier for the desired RPC method.
	 * @returns The RPC method associated with the provided ID, or undefined if it is not found.
	 *
	 * @example
	 * const registry = new TempoServiceRegistry(new ConsoleLogger());
	 * registry.init();
	 * const method = registry.getMethod(1);
	 */
	public abstract getMethod(methodId: number): BebopMethodAny | undefined;
}
