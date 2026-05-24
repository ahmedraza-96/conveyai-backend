import type { Processor, WorkerOptions, DefaultJobOptions } from "bullmq";
import { Queue as BullQueue, Worker } from "bullmq";

import logger from "./logger.service";
import redisClient from "./redis.server";

type RegisteredQueue = {
	queue: BullQueue;
	worker: Worker;
};

export interface QueueOptions {
	defaultJobOptions?: DefaultJobOptions;
	workerOptions?: Omit<WorkerOptions, "connection">;
}

declare global {
	// eslint-disable-next-line no-var
	var __registeredQueues: Record<string, RegisteredQueue> | undefined;
}

if (!global.__registeredQueues) {
	global.__registeredQueues = {};
}
const registeredQueues = global.__registeredQueues;

export function Queue<Payload>(
	name: string,
	handler: Processor<Payload>,
	options?: QueueOptions,
): BullQueue<Payload> {
	if (registeredQueues[name]) {
		return registeredQueues[name].queue as BullQueue<Payload>;
	}

	const queue = new BullQueue<Payload>(name, {
		connection: redisClient,
		defaultJobOptions: options?.defaultJobOptions,
	});

	const worker = new Worker<Payload>(name, handler, {
		connection: redisClient,
		lockDuration: 120000, // 2 minutes — prevents stalling for long-running AI jobs
		...options?.workerOptions,
	});

	worker.on("failed", (job, err) => {
		logger.error({ name: "Queue", jobId: job?.id, error: err.message }, `${name}: Job failed`);
	});

	worker.on("error", (err) => {
		logger.error({ name: "Queue", error: err.message }, `${name}: Worker error`);
	});

	registeredQueues[name] = { queue, worker };

	logger.info({ name: "Queue" }, `${name}: Initialize`);

	return queue;
}
