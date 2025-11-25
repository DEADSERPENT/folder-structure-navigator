/* ==================================================================
   GENERATE COMMAND HANDLERS
   Main structure generation commands
   ================================================================== */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { StructureGenerator } from '../core/generator';
import { StreamingGenerator } from '../core/streaming-generator';
import { StreamingFormatter } from '../utils/streaming-formatter';
import { StructureConfig } from '../models/config.interface';
import { getConfigFromSettings, showAdvancedConfigurationWizard } from '../utils/config';
import { isValidDirectory } from '../utils/fs-helpers';
import { PerformanceMonitor } from '../utils/performance';

/* ==================================================================
   MAIN GENERATE COMMAND (with optional interactive wizard)
   ================================================================== */

export async function mainGenerate(uri: vscode.Uri, interactiveWizard: boolean): Promise<void> {
    if (!uri || !(await isValidDirectory(uri.fsPath))) {
        vscode.window.showErrorMessage('Please select a valid directory.');
        return;
    }

    // 1️⃣ Pick config: either from Settings or from the wizard
    const config = interactiveWizard
        ? await showAdvancedConfigurationWizard()
        : await getConfigFromSettings();

    if (!config) {
        // user cancelled the wizard
        return;
    }

    const progressOpts = {
        location: vscode.ProgressLocation.Notification,
        title: interactiveWizard
            ? 'Generating interactive folder structure…'
            : 'Generating folder structure…',
        cancellable: true
    };

    // 2️⃣ Run generation – possibly in Worker or Streaming mode
    await vscode.window.withProgress(progressOpts, async (progress, token) => {
        const startTime = Date.now();
        try {
            let structure: string;

            if (config.useStreaming) {
                // -------------- streaming mode (memory-efficient) -----------------
                structure = await generateWithStreaming(uri.fsPath, config, progress, token);
            } else if (config.useWorker) {
                // -------------- worker thread -----------------
                structure = await generateInWorker(uri.fsPath, config, progress, token);
            } else {
                // -------------- same thread ------------------
                const generator = new StructureGenerator(
                    config,
                    (increment, message) => {
                        progress.report({ message, increment });
                    },
                    () => token.isCancellationRequested
                );
                structure = await generator.generate(uri.fsPath);
            }

            // Record performance metrics
            const duration = Date.now() - startTime;
            PerformanceMonitor.getInstance().recordOperation('generateStructure', duration);

            // 3️⃣ Save / present the result (auto-save/open respected)
            await saveAndPresentResults(uri.fsPath, structure, config);
        } catch (e) {
            if (e instanceof vscode.CancellationError) {
                vscode.window.showInformationMessage('Folder-structure generation cancelled.');
            } else {
                vscode.window.showErrorMessage(
                    `❗ Generation failed: ${e instanceof Error ? e.message : String(e)}`
                );
            }
        }
    });
}

/* ==================================================================
   STREAMING GENERATION (Memory-Efficient for Large Repos)
   ================================================================== */

async function generateWithStreaming(
    rootPath: string,
    cfg: StructureConfig,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): Promise<string> {
    const generator = new StreamingGenerator(
        cfg,
        (processed, message) => {
            progress.report({ message: `${message} (${processed} items)` });
        },
        () => token.isCancellationRequested
    );

    const formatter = new StreamingFormatter(cfg);

    // Accumulate chunks (in production, you could write directly to file)
    const chunks: string[] = [];

    for await (const event of generator.generate(rootPath)) {
        const chunk = formatter.format(event);
        if (chunk) {
            chunks.push(chunk);
        }

        // Report progress
        if (event.kind === 'progress') {
            progress.report({ message: `Processing... (${event.processed} items)` });
        }
    }

    return chunks.join('');
}

/* ==================================================================
   WORKER THREAD GENERATION (FIXED - no more crashes!)
   ================================================================== */

function generateInWorker(
    rootPath: string,
    cfg: StructureConfig,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Use the compiled worker file path
        const workerPath = path.join(__dirname, '../core/worker.js');

        const worker = new Worker(workerPath);

        // Forward cancellation → kill the worker
        token.onCancellationRequested(() => worker.terminate());

        worker.on('message', (msg: any) => {
            if (msg.type === 'progress') {
                progress.report({ message: msg.message, increment: msg.increment });
            } else if (msg.type === 'result') {
                resolve(msg.data);
                worker.terminate();
            } else if (msg.type === 'error') {
                reject(new Error(msg.error));
                worker.terminate();
            }
        });

        worker.on('error', (err) => {
            reject(err);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });

        // Send the message to start processing
        worker.postMessage({ rootPath, config: cfg });
    });
}

/* ==================================================================
   SAVE AND PRESENT RESULTS
   ================================================================== */

async function saveAndPresentResults(
    rootFolder: string,
    content: string,
    cfg: StructureConfig
): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = cfg.outputFormat === 'tree' ? 'txt' : cfg.outputFormat;
    const fileName = `structure_${stamp}.${ext}`;
    const filePath = path.join(rootFolder, fileName);

    await fs.promises.writeFile(filePath, content, 'utf8');

    const actions = ['Copy to Clipboard'];
    if (cfg.autoOpen) {
        actions.unshift('Open File');
    }
    const chosen = await vscode.window.showInformationMessage(
        `Structure saved as **${fileName}**`,
        ...actions
    );

    if (chosen === 'Open File') {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
    } else if (chosen === 'Copy to Clipboard') {
        await vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage('Structure copied to clipboard');
    }
}
