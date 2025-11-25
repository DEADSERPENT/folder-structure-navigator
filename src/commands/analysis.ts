/* ==================================================================
   AI ANALYSIS COMMAND
   ================================================================== */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StructureGenerator } from '../core/generator';
import { analyzeProjectStructure } from '../core/analyzer';
import { StructureConfig } from '../models/config.interface';
import { isValidDirectory } from '../utils/fs-helpers';

export async function generateWithAnalysisCommand(uri: vscode.Uri): Promise<void> {
    if (!uri || !(await isValidDirectory(uri.fsPath))) {
        vscode.window.showErrorMessage('Select a folder first.');
        return;
    }

    const cfg: StructureConfig = {
        includeSize: true,
        maxDepth: 8,
        respectGitignore: true,
        outputFormat: 'markdown'
    };

    const progressOpts = {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating structure + AI analysis…',
        cancellable: true
    };

    await vscode.window.withProgress(progressOpts, async (progress, token) => {
        const gen = new StructureGenerator(
            cfg,
            (increment, message) => {
                progress.report({ message, increment });
            },
            () => token.isCancellationRequested
        );
        const struct = await gen.generate(uri.fsPath);
        const analysis = analyzeProjectStructure(uri.fsPath, struct);

        const finalReport = [
            '# 📄 Project Structure + Analysis',
            '',
            struct,
            '',
            analysis
        ].join('\n');

        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const outPath = path.join(uri.fsPath, `structure-analysis_${ts}.md`);
        await fs.promises.writeFile(outPath, finalReport, 'utf8');

        const doc = await vscode.workspace.openTextDocument(outPath);
        await vscode.window.showTextDocument(doc);
    });
}
