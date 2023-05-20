import { TempoChannel } from "@tempojs/client";
import { GreeterClient } from "../shared";

// Establish a connection to the server using TempoChannel
const channel = TempoChannel.forAddress("http://localhost:3000", {
  contentType: "bebop",
});

// Get the GreeterClient from the channel
const client = channel.getClient(GreeterClient);

console.log("\n\n----- Client is ready and sending unary request... -----");

// Send a unary request
const unaryResponse = await client.sayHello({ name: "World" });
console.log("Unary response: ", unaryResponse, "\n\n");

// Define an asynchronous generator for client streaming
const clientGenerator = async function* gen() {
  yield { name: "A" };
  yield { name: "B" };
  yield { name: "C" };
};

console.log("----- Sending client stream... -----");

// Send a client stream and print the response
const clientStreamResponse = await client.sayHelloClient(clientGenerator);
console.log("Client stream response: ", clientStreamResponse, "\n\n");

console.log("----- Receiving server stream... -----");

// Receive a server stream and print each payload
for await (const payload of await client.sayHelloServer({ name: "World" })) {
  console.log("Server stream payload: ", payload);
}
console.log("\n\nServer stream complete\n\n");

console.log("----- Sending duplex stream... -----");

// Send and receive a duplex stream, printing each payload
for await (const payload of await client.sayHelloDuplex(clientGenerator)) {
  console.log("Duplex stream payload: ", payload);
}
console.log("\n\nDuplex stream complete");
