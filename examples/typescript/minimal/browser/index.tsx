import * as ReactDOM from 'react-dom';
import { TempoChannel } from "@tempojs/client";
import {TempoError} from "@tempojs/common"
import { GreeterClient } from "../shared";
import React, { useState, useEffect } from 'react';

// Establish a connection to the server using TempoChannel
const channel = TempoChannel.forAddress("http://localhost:3000", {
  contentType: "bebop",
});

const client = channel.getClient(GreeterClient);

const clientGenerator = async function* gen() {
  yield { name: "A" };
  yield { name: "B" };
  yield { name: "C" };
};


const App = () => {
  const [response, setResponse] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const unaryResponse = await client.sayHello({ name: "World" });
      setResponse(prevResponse => prevResponse + `\nUnary response: ${JSON.stringify(unaryResponse)}\n`);
      for await (const payload of await client.sayHelloServer({ name: "World" })) {
        setResponse(prevResponse => prevResponse + `Server stream payload: ${JSON.stringify(payload)}\n`);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <h2>Response from server:</h2>
      <pre>{response}</pre>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
