/* ==================================================================
   TEMPLATE MANAGEMENT COMMANDS
   ================================================================== */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfigFromSettings, loadWorkspaceTemplates, saveWorkspaceTemplate } from '../utils/config';

/* ==================================================================
   MAIN TEMPLATE MANAGER
   ================================================================== */

export async function manageTemplatesCommand(): Promise<void> {
    const action = await vscode.window.showQuickPick(
        [
            { label: '📜 List templates', id: 'list' },
            { label: '💾 Save current config as template', id: 'save' },
            { label: '📂 Load a template', id: 'load' },
            { label: '🗑️ Delete a template', id: 'delete' }
        ],
        { placeHolder: 'Template action' }
    );
    if (!action) {
        return;
    }

    switch (action.id) {
        case 'list':
            await listTemplates();
            break;
        case 'save':
            await saveCurrentConfigAsTemplate();
            break;
        case 'load':
            await loadTemplate();
            break;
        case 'delete':
            await deleteTemplate();
            break;
    }
}

/* ==================================================================
   LIST TEMPLATES
   ================================================================== */

async function listTemplates(): Promise<void> {
    const wsTemplates = await loadWorkspaceTemplates();

    let txt = '# 📚 Available templates\n\n';

    if (Object.keys(wsTemplates).length) {
        txt += '## Workspace templates\n';
        for (const [n, cfg] of Object.entries(wsTemplates)) {
            txt += `- **${n}** (format: ${cfg.outputFormat ?? 'tree'}, depth: ${cfg.maxDepth ?? '∞'})\n`;
        }
        txt += '\n';
    } else {
        txt += 'No workspace templates found.\n';
    }

    const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse('untitled:templates.md')
    );
    const ed = await vscode.window.showTextDocument(doc);
    await ed.edit(e => e.insert(new vscode.Position(0, 0), txt));
}

/* ==================================================================
   SAVE TEMPLATE
   ================================================================== */

async function saveCurrentConfigAsTemplate(): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: 'Template name',
        validateInput: v => v && /^[a-zA-Z0-9_-]+$/.test(v) ? null : 'Alphanumerics, "_" and "-" only.'
    });
    if (!name) {
        return;
    }

    const cfg = await getConfigFromSettings();
    await saveWorkspaceTemplate(name, cfg);
}

/* ==================================================================
   LOAD TEMPLATE
   ================================================================== */

async function loadTemplate(): Promise<void> {
    const wsTemplates = await loadWorkspaceTemplates();
    const choice = await vscode.window.showQuickPick(
        Object.keys(wsTemplates).map(k => ({ label: k, detail: wsTemplates[k].outputFormat })),
        { placeHolder: 'Select a template to load' }
    );
    if (!choice) {
        return;
    }

    const cfg = wsTemplates[choice.label];
    const ws = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');

    for (const [k, v] of Object.entries(cfg)) {
        await ws.update(k, v, vscode.ConfigurationTarget.Workspace);
    }
    vscode.window.showInformationMessage(`Template **${choice.label}** loaded.`);
}

/* ==================================================================
   DELETE TEMPLATE
   ================================================================== */

async function deleteTemplate(): Promise<void> {
    const wsTemplates = await loadWorkspaceTemplates();
    const choice = await vscode.window.showQuickPick(
        Object.keys(wsTemplates),
        { placeHolder: 'Select a template to delete' }
    );
    if (!choice) {
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Delete template **${choice}**?`,
        { modal: true },
        'Delete'
    );
    if (confirm !== 'Delete') {
        return;
    }

    delete wsTemplates[choice];
    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders?.length) {
        const file = path.join(wsFolders[0].uri.fsPath, '.vscode', 'folder-navigator-templates.json');
        await fs.promises.writeFile(file, JSON.stringify(wsTemplates, null, 2), 'utf8');
        vscode.window.showInformationMessage(`Template **${choice}** deleted.`);
    }
}
