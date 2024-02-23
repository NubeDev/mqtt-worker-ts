import { MqttClient } from "mqtt";
import { v4 as uuidv4 } from 'uuid';
import { IClientPublishOptions } from 'mqtt';

interface RequestConfig {
    UUID: string;
    Topic: string;
    ResponseTopic: string;
    Payload: any;
    QoS: number;
    Retain: boolean;
    TimeoutSec: number;
    RetryCount: number;
    RetryDelaySec: number;
}

interface Response {
    UUID: string;
    Topic: string;
    Payload: any;
}

export interface ResponseInfo {
    RequestUUID: string;
    Topic: string;
}

export class Client {
    MQTTClient: MqttClient;
    NumWorkers: number;
    RequestChan: RequestConfig[];
    ResponseMap: Map<string, any>;
    ErrorMap: Map<string, Error>;
    Callback: (responseInfo: ResponseInfo, response: any, err: Error | null) => void;
    activeWorkers: number;
    responseChan: Response[];

    constructor(
        mqttClient: MqttClient,
        numWorkers: number,
        callback: (responseInfo: ResponseInfo, response: any, err: Error | null) => void
    ) {
        this.MQTTClient = mqttClient;
        this.NumWorkers = numWorkers;
        this.RequestChan = [];
        this.ResponseMap = new Map<string, any>();
        this.ErrorMap = new Map<string, Error>();
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

    addRequest(reqConfig: RequestConfig): [string, Error | null] {
        if (this.activeWorkers >= this.NumWorkers) {
            return ["", new Error(`Worker pool exceeded allowable count. Active: ${this.activeWorkers}, Max: ${this.NumWorkers}`)];
        }

        const newUUID = uuidv4();
        reqConfig.UUID = newUUID;

        this.activeWorkers++;
        this.RequestChan.push(reqConfig);

        return [newUUID, null];
    }

    private async worker() {
        while (this.RequestChan.length > 0) {
            const reqConfig = this.RequestChan.shift();
            if (!reqConfig) {
                continue;
            }

            let responseReceived = false;

            const responseHandler = (topic: string, payload: Buffer) => {
                this.responseChan.push({ Topic: topic, Payload: payload, UUID: reqConfig.UUID });
                responseReceived = true;
            };

            console.log(`Subscribing to response topic: ${reqConfig.ResponseTopic}`);
            this.MQTTClient.subscribe(reqConfig.ResponseTopic, async (err) => {
                if (err) {
                    console.error(`Error subscribing to ResponseTopic ${reqConfig.ResponseTopic}: ${err}`);
                    return;
                }

                for (let attempt = 0; attempt <= reqConfig.RetryCount; attempt++) {
                    if (attempt > 0) {
                        await delay(reqConfig.RetryDelaySec * 1000);
                        console.log(`Retrying request for topic ${reqConfig.Topic}: attempt number ${attempt} of ${reqConfig.RetryCount} ${new Date().toLocaleTimeString()}`);
                    }

                    // Publish the message
                    this.MQTTClient.publish(reqConfig.Topic, JSON.stringify(reqConfig.Payload), {
                        qos: reqConfig.QoS,
                        retain: reqConfig.Retain
                    } as IClientPublishOptions, (err) => {
                        if (err) {
                            console.error(`Error sending request for topic ${reqConfig.Topic}: ${err}`);
                            return;
                        }

                        setTimeout(() => {
                            if (!responseReceived) {
                                console.log(`Timeout waiting for response on topic ${reqConfig.ResponseTopic}`);
                                if (attempt === reqConfig.RetryCount) {
                                    const responseInfo: ResponseInfo = {
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
                    } else {
                        console.log(`Unsubscribed from response topic: ${reqConfig.ResponseTopic}`);

                    }
                });

                this.activeWorkers--;
            });
        }
    }

    private listenForResponses() {
        while (this.responseChan.length > 0) {
            const response = this.responseChan.shift();
            if (!response) {
                continue;
            }

            this.ResponseMap.set(response.Topic, response.Payload);
            const responseInfo: ResponseInfo = { RequestUUID: response.UUID, Topic: response.Topic };
            this.Callback(responseInfo, response.Payload, null);
        }
    }

    getResponse(topic: string): [any, Error | null] {
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


function getCurrentTime(): string {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
}


function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
