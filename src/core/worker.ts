/* ==================================================================
   WORKER THREAD ENTRY POINT
   This file runs in a separate thread and has NO vscode dependencies
   ================================================================== */

import { parentPort } from 'worker_threads';
import { StructureGenerator } from './generator';
import { StructureConfig } from '../models/config.interface';

if (!parentPort) {
    throw new Error('This module must be run as a Worker thread');
}

// Listen for messages from the main thread
parentPort.on('message', async (msg: { rootPath: string; config: StructureConfig }) => {
    const { rootPath, config } = msg;

    // Define a progress callback that posts back to main thread
    const onProgress = (increment: number, message: string) => {
        parentPort!.postMessage({ type: 'progress', increment, message });
    };

    // No cancellation in worker for now (can be added later)
    const isCancelled = () => false;

    try {
        const generator = new StructureGenerator(config, onProgress, isCancelled);
        const result = await generator.generate(rootPath);
        parentPort!.postMessage({ type: 'result', data: result });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        parentPort!.postMessage({ type: 'error', error: errorMessage });
    }
});
