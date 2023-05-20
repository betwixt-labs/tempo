import { ServerContext } from "@tempojs/server";
import {
  BaseGreeterService,
  IHelloRequest,
  IHelloResponse,
  TempoServiceRegistry,
} from "../shared";

/**
 * GreeterService class extends BaseGreeterService to provide various greeting services.
 * It is registered to the TempoServiceRegistry with the service name of BaseGreeterService.
 */
@TempoServiceRegistry.register(BaseGreeterService.serviceName)
export class GreeterService extends BaseGreeterService {
  /**
   * The sayHello method takes a record and context as input, and returns a greeting message.
   *
   * @param record - The input request containing the name.
   * @param context - The server context.
   * @returns - A promise that resolves to a greeting message.
   */
  public override async sayHello(
    record: IHelloRequest,
    context: ServerContext
  ): Promise<IHelloResponse> {
    return Promise.resolve({ serviceMessage: `Hello ${record.name}` });
  }

  /**
   * The sayHelloClient method takes a function generating multiple records and context as input, 
   * counts the number of messages sent, and returns that count in the response.
   *
   * @param records - An async generator function that yields multiple records.
   * @param context - The server context.
   * @returns - A promise that resolves to the number of messages sent.
   */
  public override async sayHelloClient(
    records: () => AsyncGenerator<IHelloRequest, void, undefined>,
    context: ServerContext
  ): Promise<IHelloResponse> {
    let count = 0;
   
    for await (const _ of records()) {
      count++;
    }
    return { serviceMessage: `You sent ${count} messages` };
  }

  /**
   * The sayHelloServer method sends back a series of 10 greeting messages to the client.
   *
   * @param record - The input request containing the name.
   * @param context - The server context.
   * @returns - An async generator that yields a series of greeting messages.
   */
  public override async* sayHelloServer(
    record: IHelloRequest,
    context: ServerContext
  ): AsyncGenerator<IHelloResponse, void, undefined> {
    for (let i = 0; i < 10; i++) {
      yield { serviceMessage: `Hello ${record.name} / ${i}` };
    }
  }

  /**
   * The sayHelloDuplex method takes a function generating multiple records and context as input, 
   * and for each record, it sends back a greeting message to the client.
   *
   * @param records - An async generator function that yields multiple records.
   * @param context - The server context.
   * @returns - An async generator that yields a greeting message for each request record.
   */
  public override async* sayHelloDuplex(
    records: () => AsyncGenerator<IHelloRequest, void, undefined>,
    context: ServerContext
  ): AsyncGenerator<IHelloResponse, void, undefined> {
    for await (const value of records()) {
      yield { serviceMessage: `Hello ${value.name}` };
    }
  }
}
