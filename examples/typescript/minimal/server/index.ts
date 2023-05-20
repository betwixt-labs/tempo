import { ConsoleLogger } from "@tempojs/common";
import { TempoServiceRegistry } from "../shared";
import { IncomingMessage, ServerResponse, createServer } from "http";
import { TempoRouterConfiguration } from "@tempojs/server";
import { TempoRouter } from "@tempojs/node-http-router";
import * as Services from "./service";
// temporary workaround for registry race condition
console.log(Services);

const logger = new ConsoleLogger("Router");
const config = new TempoRouterConfiguration();
config.enableCors = true;
config.allowedOrigins = ["http://127.0.0.1:3001", "http://localhost:8081", "http://localhost:8080"];
const registry = new TempoServiceRegistry(logger);
const router = new TempoRouter<object>(logger, registry,config);
const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    await router.process(req, res, {});
  }
);
server.listen(3000);
