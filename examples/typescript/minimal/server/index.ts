import { ConsoleLogger, HookRegistry } from "@tempojs/common";
import { TempoServiceRegistry } from "../shared";
import { IncomingMessage, ServerResponse, createServer } from "http";
import { TempoRouterConfiguration, ServerContext } from "@tempojs/server";
import { TempoRouter } from "@tempojs/node-http-router";
import * as Services from "./service";
// temporary workaround for registry race condition
console.log(Services);

const logger = new ConsoleLogger("Router");
const config = new TempoRouterConfiguration();
const registry = new TempoServiceRegistry(logger);

const router = new TempoRouter<object>(logger, registry,config);
const hooks = new HookRegistry<ServerContext, object>({});
hooks.registerHook("request", (context) => {
    const headers: Record<string, string> = {

    };
    context.clientHeaders().forEach((v, k) => {
         headers[k] = v;
    })
    logger.info("headers", headers)
});

router.useHooks(hooks);


const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    await router.process(req, res, {});
  }
);
server.listen(3000);
