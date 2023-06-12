import { parentPort, workerData } from 'worker_threads';
import { BedrockPingOptions, JavaPingOptions, PingData, PingDataManager } from '../PingDataManager.js';

if (!parentPort) process.exit(1);

const pingOptions: JavaPingOptions|BedrockPingOptions = workerData;
const pingData: PingData = await PingDataManager.pingServer({ ...pingOptions, useWorkerThread: false });

parentPort.postMessage(pingData);