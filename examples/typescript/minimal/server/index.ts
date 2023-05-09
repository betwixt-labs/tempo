import { ConsoleLogger } from "@tempojs/common";
import { TempoServiceRegistry } from "../shared";
import { IncomingMessage, ServerResponse, createServer } from "http";
import { TempoRouter } from "@tempojs/node-http-router";
import * as Services from "./service";
// temporary workaround for registry race condition
console.log(Services);

const logger = new ConsoleLogger("Router");
const registry = new TempoServiceRegistry(logger);
const router = new TempoRouter<object>(logger, registry);
const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    await router.process(req, res, {});
  }
);
server.listen(3000);
