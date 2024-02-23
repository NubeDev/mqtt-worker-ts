"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mqtt_1 = require("mqtt");
const test_1 = require("./mqttc/test"); // Assume the Client class is in a file named 'Client.ts'
// Connect to the MQTT broker
const mqttClient = (0, mqtt_1.connect)('mqtt://localhost:1883');
// Define a callback function for handling responses
const callback = (responseInfo, response, err) => {
    if (err) {
        console.error(`Error: ${err}`);
    }
    else {
        console.log(`Response received for request UUID ${responseInfo.RequestUUID} on topic ${responseInfo.Topic}: ${JSON.stringify(response)}`);
    }
};
// Create an instance of the Client class
const client = new test_1.Client(mqttClient, 5, callback);
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
}
else {
    console.log(`Request added with UUID: ${uuid}`);
}
// Start sending requests
client.sendRequests();
// Example: Get a response for a specific topic (you can use this after you've received a response)
setTimeout(() => {
    const [response, err] = client.getResponse('response/topic');
    if (err) {
        console.error(`Error getting response: ${err}`);
    }
    else {
        console.log(`Response for topic 'response/topic': ${JSON.stringify(response)}`);
    }
}, 10000); // Wait 10 seconds before trying to get a response
