import { TempoChannel } from "@tempojs/client";
import { GreeterClient } from "../shared";


const channel = TempoChannel.forAddress("http://localhost:3000");
const client = channel.getClient(GreeterClient);
const response = await client.sayHello({name: "World"});
console.log(response.serviceMessage);