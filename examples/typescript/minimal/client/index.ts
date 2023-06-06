import { TempoChannel } from "@tempojs/client";
import { GreeterClient, IHelloRequest } from "../shared";

// Establish a connection to the server using TempoChannel
const channel = TempoChannel.forAddress("http://localhost:3000");

// Get the GreeterClient from the channel
const client = channel.getClient(GreeterClient);

const request: IHelloRequest = {
  name: "World"
}

console.log(await client.sayHello(request))