/* ==================================================================
   BATCH PROCESSING COMMAND
   ================================================================== */

import * as vscode from 'vscode';
import * as path from 'path';
import { StructureGenerator } from '../core/generator';
import { showAdvancedConfigurationWizard } from '../utils/config';

export async function batchProcessCommand(): Promise<void> {
    const dirs = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: 'Select folders for batch processing'
    });
    if (!dirs?.length) {
        return;
    }

    const cfg = await showAdvancedConfigurationWizard();
    if (!cfg) {
        return;
    }

    const progressOpts = {
        location: vscode.ProgressLocation.Notification,
        title: 'Batch processing…',
        cancellable: true
    };

    await vscode.window.withProgress(progressOpts, async (progress, token) => {
        const parts: string[] = [];

        for (let i = 0; i < dirs.length; i++) {
            if (token.isCancellationRequested) {
                break;
            }
            const folder = dirs[i];
            progress.report({
                message: `Processing ${path.basename(folder.fsPath)} (${i + 1}/${dirs.length})`,
                increment: Math.round(100 / dirs.length)
            });

            try {
                const gen = new StructureGenerator(
                    cfg,
                    undefined,
                    () => token.isCancellationRequested
                );
                const out = await gen.generate(folder.fsPath);
                parts.push(`## 📁 ${path.basename(folder.fsPath)}\n\`\`\`\n${out}\n\`\`\`\n`);
            } catch (e) {
                parts.push(`## ❌ ${path.basename(folder.fsPath)}\n*Error:* ${e instanceof Error ? e.message : String(e)}\n`);
            }
        }

        const report = [
            '# 📊 Batch processing report',
            `**Generated:** ${new Date().toISOString()}`,
            '',
            ...parts
        ].join('\n');

        const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.parse('untitled:batch-report.md')
        );
        const ed = await vscode.window.showTextDocument(doc);
        await ed.edit(e => e.insert(new vscode.Position(0, 0), report));
    });
}
