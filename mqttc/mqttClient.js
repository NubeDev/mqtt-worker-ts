"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const uuid_1 = require("uuid");
class Client {
    constructor(mqttClient, numWorkers, callback) {
        this.MQTTClient = mqttClient;
        this.NumWorkers = numWorkers;
        this.RequestChan = [];
        this.ResponseMap = new Map();
        this.ErrorMap = new Map();
        this.Callback = callback;
        this.activeWorkers = 0;
        this.responseChan = [];
        this.listenForResponses();
    }
    get Client() {
        return this.MQTTClient;
    }
    sendRequests() {
        for (let i = 0; i < this.NumWorkers; i++) {
            this.worker();
        }
    }
    addRequest(reqConfig) {
        if (this.activeWorkers >= this.NumWorkers) {
            return ["", new Error(`Worker pool exceeded allowable count. Active: ${this.activeWorkers}, Max: ${this.NumWorkers}`)];
        }
        const newUUID = (0, uuid_1.v4)();
        reqConfig.UUID = newUUID;
        this.activeWorkers++;
        this.RequestChan.push(reqConfig);
        return [newUUID, null];
    }
    worker() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.RequestChan.length > 0) {
                const reqConfig = this.RequestChan.shift();
                if (!reqConfig) {
                    continue;
                }
                let responseReceived = false;
                const responseHandler = (topic, payload) => {
                    this.responseChan.push({ Topic: topic, Payload: payload, UUID: reqConfig.UUID });
                    responseReceived = true;
                };
                console.log(`Subscribing to response topic: ${reqConfig.ResponseTopic}`);
                this.MQTTClient.subscribe(reqConfig.ResponseTopic, (err) => __awaiter(this, void 0, void 0, function* () {
                    if (err) {
                        console.error(`Error subscribing to ResponseTopic ${reqConfig.ResponseTopic}: ${err}`);
                        return;
                    }
                    for (let attempt = 0; attempt <= reqConfig.RetryCount; attempt++) {
                        if (attempt > 0) {
                            yield delay(reqConfig.RetryDelaySec * 1000);
                            console.log(`Retrying request for topic ${reqConfig.Topic}: attempt number ${attempt} of ${reqConfig.RetryCount} ${new Date().toLocaleTimeString()}`);
                        }
                        // Publish the message
                        this.MQTTClient.publish(reqConfig.Topic, JSON.stringify(reqConfig.Payload), {
                            qos: reqConfig.QoS,
                            retain: reqConfig.Retain
                        }, (err) => {
                            if (err) {
                                console.error(`Error sending request for topic ${reqConfig.Topic}: ${err}`);
                                return;
                            }
                            setTimeout(() => {
                                if (!responseReceived) {
                                    console.log(`Timeout waiting for response on topic ${reqConfig.ResponseTopic}`);
                                    if (attempt === reqConfig.RetryCount) {
                                        const responseInfo = {
                                            RequestUUID: reqConfig.UUID,
                                            Topic: reqConfig.Topic
                                        };
                                        this.Callback(responseInfo, null, new Error(`Timeout waiting for response on topic ${reqConfig.ResponseTopic} after ${reqConfig.RetryCount + 1} attempts`));
                                    }
                                }
                            }, reqConfig.TimeoutSec * 1000);
                        });
                        if (responseReceived) {
                            break;
                        }
                    }
                    this.MQTTClient.unsubscribe(reqConfig.ResponseTopic, (err) => {
                        if (err) {
                            console.error(`Error unsubscribing from ResponseTopic ${reqConfig.ResponseTopic}: ${err}`);
                        }
                        else {
                            console.log(`Unsubscribed from response topic: ${reqConfig.ResponseTopic}`);
                        }
                    });
                    this.activeWorkers--;
                }));
            }
        });
    }
    listenForResponses() {
        while (this.responseChan.length > 0) {
            const response = this.responseChan.shift();
            if (!response) {
                continue;
            }
            this.ResponseMap.set(response.Topic, response.Payload);
            const responseInfo = { RequestUUID: response.UUID, Topic: response.Topic };
            this.Callback(responseInfo, response.Payload, null);
        }
    }
    getResponse(topic) {
        const response = this.ResponseMap.get(topic);
        if (!response) {
            const error = this.ErrorMap.get(topic);
            if (error) {
                return [null, error];
            }
            return [null, new Error(`Response for topic ${topic} not found`)];
        }
        return [response, null];
    }
}
exports.Client = Client;
function getCurrentTime() {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
