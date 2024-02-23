import { connect, MqttClient } from 'mqtt';
import { Client, ResponseInfo } from './mqttc/mqttClient'; // Assume the Client class is in a file named 'Client.ts'

// Connect to the MQTT broker
const mqttClient: MqttClient = connect('mqtt://localhost:1883');

// Define a callback function for handling responses
const callback = (responseInfo: ResponseInfo, response: any, err: Error | null) => {
    if (err) {
        console.error(`Error: ${err}`);
    } else {
        console.log(`Response received for request UUID ${responseInfo.RequestUUID} on topic ${responseInfo.Topic}: ${JSON.stringify(response)}`);
    }
};

// Create an instance of the Client class
const client = new Client(mqttClient, 5, callback);

// Define a request configuration
const requestConfig = {
    UUID: '',
    Topic: 'request/topic',
    ResponseTopic: 'response/topic',
    Payload: { message: 'Hello, MQTT!' },
    QoS: 0,
    Retain: false,
    TimeoutSec: 5,
    RetryCount: 3,
    RetryDelaySec: 2,
};

// Add the request to the client
// Add the request to the client
const [uuid, err] = client.addRequest(requestConfig);
if (err) {
    console.error(`Error adding request: ${err}`);
} else {
    console.log(`Request added with UUID: ${uuid}`);
}


// Start sending requests
client.sendRequests();

// Example: Get a response for a specific topic (you can use this after you've received a response)
setTimeout(() => {
    const [response, err] = client.getResponse('response/topic');
    if (err) {
        console.error(`Error getting response: ${err}`);
    } else {
        console.log(`Response for topic 'response/topic': ${JSON.stringify(response)}`);
    }
}, 10000); // Wait 10 seconds before trying to get a response
