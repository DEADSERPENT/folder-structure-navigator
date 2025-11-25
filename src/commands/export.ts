/* ==================================================================
   EXPORT STRUCTURE COMMAND
   ================================================================== */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StructureGenerator } from '../core/generator';
import { getConfigFromSettings } from '../utils/config';
import { isValidDirectory } from '../utils/fs-helpers';

export async function exportStructureCommand(uri: vscode.Uri): Promise<void> {
    if (!uri || !(await isValidDirectory(uri.fsPath))) {
        vscode.window.showErrorMessage('Select a valid folder first.');
        return;
    }

    const format = await vscode.window.showQuickPick(
        ['Tree View', 'JSON', 'Markdown', 'XML', 'CSV'],
        { placeHolder: 'Export format' }
    );
    if (!format) {
        return;
    }

    const cfg = await getConfigFromSettings();
    cfg.outputFormat = format.toLowerCase().replace(' view', '') as any;

    const gen = new StructureGenerator(cfg);
    const result = await gen.generate(uri.fsPath);

    const outPath = path.join(uri.fsPath, `exported_structure.${cfg.outputFormat}`);
    await fs.promises.writeFile(outPath, result, 'utf8');
    vscode.window.showInformationMessage(`Structure exported to ${outPath}`);
}
