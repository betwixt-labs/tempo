import { ServerContext } from "@tempojs/server";
import {
  BaseGreeterService,
  IHelloRequest,
  IHelloResponse,
  TempoServiceRegistry,
} from "../shared";

@TempoServiceRegistry.register(BaseGreeterService.serviceName)
export class GreeterService extends BaseGreeterService {
  public sayHello(
    record: IHelloRequest,
    context: ServerContext
  ): Promise<IHelloResponse> {
    return Promise.resolve({ serviceMessage: `Hello ${record.name}`});
  }
}
