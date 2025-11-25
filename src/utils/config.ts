/* ==================================================================
   CONFIGURATION UTILITIES
   Handles configuration loading and interactive wizards
   ================================================================== */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StructureConfig } from '../models/config.interface';

/* ==================================================================
   LOAD CONFIGURATION FROM SETTINGS
   ================================================================== */

export async function getConfigFromSettings(): Promise<StructureConfig> {
    const cfg = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');

    return {
        includeHidden: cfg.get<boolean>('includeHiddenFiles') ?? false,
        extensionFilter: cfg.get<string[]>('extensionFilter') ?? null,
        excludeFolders: cfg.get<string[]>('excludeFolders') ?? [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.vscode'
        ],
        excludePatterns: cfg.get<string[]>('excludePatterns') ?? null,
        maxDepth: cfg.get<number>('maxDepth') ?? 10,
        respectGitignore: cfg.get<boolean>('respectGitignore') ?? true,
        includeSize: cfg.get<boolean>('includeSize') ?? false,
        includePermissions: cfg.get<boolean>('includePermissions') ?? false,
        includeModifiedDate: cfg.get<boolean>('includeModifiedDate') ?? false,
        sortBy: cfg.get<'name' | 'size' | 'modified' | 'type'>('sortBy') ?? 'name',
        outputFormat: cfg.get<'tree' | 'json' | 'markdown' | 'xml' | 'csv'>('outputFormat') ?? 'tree',
        useWorker: cfg.get<boolean>('useWorker') ?? false,
        useStreaming: cfg.get<boolean>('useStreaming') ?? false,
        iconStyle: cfg.get<'emoji' | 'unicode' | 'ascii' | 'none'>('iconStyle') ?? 'emoji',
        customIcons: cfg.get<Record<string, string>>('customIcons') ?? {},
        compressLargeDirs: cfg.get<boolean>('compressLargeDirs') ?? true,
        compressionThreshold: cfg.get<number>('compressionThreshold') ?? 50,
        autoSave: cfg.get<boolean>('autoSave') ?? true,
        autoOpen: cfg.get<boolean>('autoOpen') ?? true
    };
}

/* ==================================================================
   INTERACTIVE CONFIGURATION WIZARD
   ================================================================== */

export async function showAdvancedConfigurationWizard(): Promise<StructureConfig | null> {
    const cfg: Partial<StructureConfig> = {};

    // ---- step 1 : basic toggles ------------------------------------
    const basic = await vscode.window.showQuickPick(
        [
            { label: '📁 Include hidden files', value: 'includeHidden' },
            { label: '📏 Include file sizes', value: 'includeSize' },
            { label: '🔒 Include permissions', value: 'includePermissions' },
            { label: '⏰ Include modified dates', value: 'includeModifiedDate' },
            { label: '🚫 Respect .gitignore', value: 'respectGitignore' }
        ],
        { canPickMany: true, placeHolder: 'Select basic options' }
    );
    if (!basic) {
        return null; // cancelled
    }
    cfg.includeHidden = basic.some(i => i.value === 'includeHidden');
    cfg.includeSize = basic.some(i => i.value === 'includeSize');
    cfg.includePermissions = basic.some(i => i.value === 'includePermissions');
    cfg.includeModifiedDate = basic.some(i => i.value === 'includeModifiedDate');
    cfg.respectGitignore = basic.some(i => i.value === 'respectGitignore');

    // ---- step 2 : filtering mode ------------------------------------
    const filterMode = await vscode.window.showQuickPick(
        [
            { label: '🔎 Standard filtering (folders / glob patterns)', value: 'standard' },
            { label: '🎯 Whitelist extensions only', value: 'extensions' },
            { label: '🚫 Exclude by patterns', value: 'exclude' }
        ],
        { placeHolder: 'Choose filtering strategy' }
    );
    if (!filterMode) {
        return null;
    }

    if (filterMode.value === 'extensions') {
        const txt = await vscode.window.showInputBox({
            prompt: 'Comma-separated list of extensions (e.g. js,ts,json)',
            validateInput: v => v && /^[a-zA-Z0-9,.\s]+$/.test(v) ? null : 'Invalid list'
        });
        if (txt) {
            cfg.extensionFilter = txt.split(',').map(s => s.trim().replace(/^\./, '').toLowerCase());
        }
    } else if (filterMode.value === 'exclude') {
        const txt = await vscode.window.showInputBox({
            prompt: 'Comma-separated glob patterns to exclude (e.g. *.log,temp/**,test/*)'
        });
        if (txt) {
            cfg.excludePatterns = txt.split(',').map(s => s.trim());
        }
    }

    // ---- step 3 : output format --------------------------------------
    const fmt = await vscode.window.showQuickPick(
        [
            { label: '🌳 Tree view', value: 'tree' },
            { label: '📋 JSON', value: 'json' },
            { label: '📝 Markdown', value: 'markdown' },
            { label: '🏷️ XML', value: 'xml' },
            { label: '📄 CSV', value: 'csv' }
        ],
        { placeHolder: 'Select output format' }
    );
    if (!fmt) {
        return null;
    }
    cfg.outputFormat = fmt.value as any;

    // ---- step 4 : depth & icons --------------------------------------
    const depthStr = await vscode.window.showInputBox({
        prompt: 'Maximum traversal depth (0 = unlimited, default = 10)',
        value: '10',
        validateInput: v => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 0 ? null : 'Enter a non-negative integer';
        }
    });
    if (depthStr) {
        cfg.maxDepth = Number(depthStr) || undefined;
    }

    const iconStyle = await vscode.window.showQuickPick(
        [
            { label: '😀 Emoji icons', value: 'emoji' },
            { label: '🔠 Unicode icons', value: 'unicode' },
            { label: '🅰️ ASCII icons', value: 'ascii' },
            { label: '❌ No icons', value: 'none' }
        ],
        { placeHolder: 'Icon style' }
    );
    if (iconStyle) {
        cfg.iconStyle = iconStyle.value as any;
    }

    // ---- step 5 : compression & auto-behaviour ----------------------
    const compress = await vscode.window.showQuickPick(
        [
            { label: '✅ Collapse large dirs', value: true },
            { label: '🚫 Keep every folder expanded', value: false }
        ],
        { placeHolder: 'Compress large directories?' }
    );
    cfg.compressLargeDirs = compress?.value ?? true;

    const thresholdStr = await vscode.window.showInputBox({
        prompt: 'Collapse threshold – number of items that triggers compression',
        value: cfg.compressLargeDirs ? '50' : '0',
        validateInput: v => Number.isInteger(Number(v)) && Number(v) >= 0 ? null : 'Enter a non-negative integer'
    });
    cfg.compressionThreshold = thresholdStr ? Number(thresholdStr) : 50;

    const autoSave = await vscode.window.showQuickPick(
        [
            { label: '💾 Auto-save after generation', value: true },
            { label: '🛑 Do **not** auto-save (prompt later)', value: false }
        ],
        { placeHolder: 'Auto-save?' }
    );
    cfg.autoSave = autoSave?.value ?? true;

    const autoOpen = await vscode.window.showQuickPick(
        [
            { label: '📂 Auto-open the generated file', value: true },
            { label: '🚪 Do **not** auto-open', value: false }
        ],
        { placeHolder: 'Auto-open?' }
    );
    cfg.autoOpen = autoOpen?.value ?? true;

    return cfg as StructureConfig;
}

/* ==================================================================
   PRESET MANAGEMENT
   ================================================================== */

export async function applyPreset(presetName: string): Promise<void> {
    const ws = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');
    const allPresets = ws.get<Record<string, StructureConfig>>('presets') ?? {};

    const preset = allPresets[presetName];
    if (!preset) {
        vscode.window.showErrorMessage(`Preset **${presetName}** not found.`);
        return;
    }

    for (const [k, v] of Object.entries(preset)) {
        await ws.update(k, v, vscode.ConfigurationTarget.Workspace);
    }
    vscode.window.showInformationMessage(`Preset **${presetName}** applied.`);
}

/* ==================================================================
   WORKSPACE TEMPLATE MANAGEMENT
   ================================================================== */

export async function loadWorkspaceTemplates(): Promise<Record<string, StructureConfig>> {
    const ws = vscode.workspace.workspaceFolders;
    if (!ws?.length) {
        return {};
    }

    const file = path.join(ws[0].uri.fsPath, '.vscode', 'folder-navigator-templates.json');
    try {
        const data = await fs.promises.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export async function saveWorkspaceTemplate(name: string, cfg: StructureConfig): Promise<void> {
    const ws = vscode.workspace.workspaceFolders;
    if (!ws?.length) {
        throw new Error('No workspace folder');
    }

    const vscodeDir = path.join(ws[0].uri.fsPath, '.vscode');
    await fs.promises.mkdir(vscodeDir, { recursive: true });

    const file = path.join(vscodeDir, 'folder-navigator-templates.json');
    let existing: Record<string, StructureConfig> = {};

    try {
        const raw = await fs.promises.readFile(file, 'utf8');
        existing = JSON.parse(raw);
    } catch {
        // ignore – start fresh
    }

    existing[name] = cfg;
    await fs.promises.writeFile(file, JSON.stringify(existing, null, 2), 'utf8');
    vscode.window.showInformationMessage(`Template **${name}** saved to workspace`);
}
