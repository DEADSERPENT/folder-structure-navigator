/* --------------------------------------------------------------
   Folder Structure Navigator – v2.0 (full‑feature implementation)
   -------------------------------------------------------------- */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Worker } from 'worker_threads';

/* ==================================================================
   TYPE DEFINITIONS
   ================================================================== */

interface StructureConfig {
    // ---- filtering --------------------------------------------------
    includeHidden?: boolean;
    extensionFilter?: string[] | null;
    excludeFolders?: string[] | null;
    excludePatterns?: string[] | null;
    maxDepth?: number;                // 0 = unlimited
    respectGitignore?: boolean;

    // ---- metadata ---------------------------------------------------
    includeSize?: boolean;
    includePermissions?: boolean;
    includeModifiedDate?: boolean;    // NEW

    // ---- UI / output ------------------------------------------------
    sortBy?: 'name' | 'size' | 'modified' | 'type';
    outputFormat?: 'tree' | 'json' | 'markdown' | 'xml' | 'csv'; // CSV added
    useWorker?: boolean;              // NEW – run generation in a Worker thread

    // ---- visual tweaks -----------------------------------------------
    iconStyle?: 'emoji' | 'unicode' | 'ascii' | 'none';          // NEW
    customIcons?: Record<string, string>;                       // NEW

    // ---- compression of large directories -----------------------------
    compressLargeDirs?: boolean;        // NEW
    compressionThreshold?: number;     // NEW – items > N triggers collapse

    // ---- auto‑behaviour ------------------------------------------------
    autoSave?: boolean;                // NEW
    autoOpen?: boolean;                // NEW
}

/* ------------------------------------------------------------------
   INTERNAL MODELS (used while building the tree)
   ------------------------------------------------------------------ */
interface FileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'symlink';
    size?: number;
    modified?: Date;
    permissions?: string;
    children?: FileEntry[];
}

/* ------------------------------------------------------------------
   GITIGNORE HELPERS
   ------------------------------------------------------------------ */
interface GitignoreRules {
    patterns: string[];
    isIgnored: (filePath: string) => boolean;
}

/* ------------------------------------------------------------------
   PLUGIN INTERFACE (kept for future extensibility)
   ------------------------------------------------------------------ */
interface StructurePlugin {
    name: string;
    version: string;
    processEntry?(entry: FileEntry): FileEntry;
    formatOutput?(structure: string, format: string): string;
    addCommands?(context: vscode.ExtensionContext): void;
}

/* ==================================================================
   GLOBAL CACHES & SINGLETONS
   ================================================================== */

const gitignoreCache = new Map<string, GitignoreRules>();
const statsCache = new Map<string, fs.Stats>();

/* ==================================================================
   EXTENSION LIFECYCLE
   ================================================================== */
export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Advanced Folder Structure Navigator v2.0 is now active!');

    // -----------------------------------------------------------------
    // 1️⃣ REGISTER ALL COMMANDS (IDs match the README)
    // -----------------------------------------------------------------
    const generateStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateStructure',
        async (uri: vscode.Uri) => mainGenerate(uri, false) // UI‑wizard = false
    );

    const generateInteractiveStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateInteractiveStructure',
        async (uri: vscode.Uri) => mainGenerate(uri, true) // UI‑wizard = true
    );

    const compareDirectories = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.compareDirectories',
        () => compareDirectoryStructures()
    );

    const exportStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.exportStructure',
        async (uri: vscode.Uri) => exportStructureCommand(uri)
    );

    const showPerformanceReport = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.showPerformanceReport',
        () => showPerformanceReportCommand()
    );

    const manageTemplates = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.manageTemplates',
        () => manageTemplatesCommand()
    );

    const batchProcess = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.batchProcess',
        () => batchProcessCommand()
    );

    const generateWithAnalysis = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateWithAnalysis',
        async (uri: vscode.Uri) => generateWithAnalysisCommand(uri)
    );

    // Preset commands (the README lists four of them)
    const applyMinimalPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyMinimalPreset',
        () => applyPreset('minimal')
    );
    const applyDetailedPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyDetailedPreset',
        () => applyPreset('detailed')
    );
    const applyDocumentationPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyDocumentationPreset',
        () => applyPreset('documentation')
    );
    const applyDevelopmentPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyDevelopmentPreset',
        () => applyPreset('development')
    );

    // -----------------------------------------------------------------
    // 2️⃣ PUSH ALL REGISTRATIONS
    // -----------------------------------------------------------------
    context.subscriptions.push(
        generateStructure,
        generateInteractiveStructure,
        compareDirectories,
        exportStructure,
        showPerformanceReport,
        manageTemplates,
        batchProcess,
        generateWithAnalysis,
        applyMinimalPreset,
        applyDetailedPreset,
        applyDocumentationPreset,
        applyDevelopmentPreset
    );
}

/* --------------------------------------------------------------
   DEACTIVATION – clear caches & log final metrics
   -------------------------------------------------------------- */
export function deactivate() {
    AdvancedCache.getInstance().clear();
    gitignoreCache.clear();
    statsCache.clear();

    const monitor = PerformanceMonitor.getInstance();
    console.log('🛑 Final Performance Report:\n', monitor.getMetricsReport());

    console.log('Advanced Folder Structure Navigator v2.0 deactivated');
}

/* ==================================================================
   CORE LOGIC – GENERATION (threaded or not)
   ================================================================== */

/**
 * Master entry‑point for the two “generate” commands.
 * @param uri   Folder the user right‑clicked on
 * @param interactiveWizard   true → show the step‑by‑step UI first
 */
async function mainGenerate(uri: vscode.Uri, interactiveWizard: boolean) {
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

    // 2️⃣ Run generation – possibly inside a Worker
    await vscode.window.withProgress(progressOpts, async (progress, token) => {
        try {
            let structure: string;

            if (config.useWorker) {
                // -------------- worker thread -----------------
                structure = await generateInWorker(uri.fsPath, config, progress, token);
            } else {
                // -------------- same thread ------------------
                const generator = new StructureGenerator(
                    config,
                    progress,
                    token
                );
                const root = await generator.generate(uri.fsPath);
                structure = root; // `generate` already returns a formatted string
            }

            // 3️⃣ Save / present the result (auto‑save/open respected)
            await saveAndPresentResults(uri.fsPath, structure, config);
        } catch (e) {
            if (e instanceof vscode.CancellationError) {
                vscode.window.showInformationMessage('Folder‑structure generation cancelled.');
            } else {
                vscode.window.showErrorMessage(
                    `❗ Generation failed: ${e instanceof Error ? e.message : String(e)}`
                );
            }
        }
    });
}

/**
 * If `useWorker` is true we spin a **Worker thread** that only
 * builds the tree.  The heavy fs‑calls stay off the UI thread.
 */
function generateInWorker(
    rootPath: string,
    cfg: StructureConfig,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
): Promise<string> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            // The small inline script (no external file) – we serialize
            // the config & root path and let the worker re‑use the
            // StructureGenerator implementation.
            `
            const { parentPort } = require('worker_threads');
            const path = require('path');
            const fs = require('fs');

            // ---- tiny copy of the generator (same code as in the main file) ----
            ${StructureGenerator.toString()}
            // ---- end of copy ---------------------------------------------------

            parentPort.on('message', async ({rootPath, config}) => {
                try {
                    const gen = new StructureGenerator(config);
                    const result = await gen.generate(rootPath);
                    parentPort.postMessage({result});
                } catch (err) {
                    parentPort.postMessage({error: err?.message ?? String(err)});
                }
            });
            `,
            { eval: true }
        );

        // Forward cancellation → kill the worker
        token.onCancellationRequested(() => worker.terminate());

        worker.once('message', (msg: any) => {
            if (msg.error) {
                reject(new Error(msg.error));
            } else {
                resolve(msg.result);
            }
        });

        worker.once('error', reject);
        worker.postMessage({ rootPath, config: cfg });
    });
}

/* -----------------------------------------------------------------
   STRUCTURE GENERATOR (core of the extension)
   ----------------------------------------------------------------- */
class StructureGenerator {
    private readonly cfg: Required<StructureConfig>;
    private readonly progress?: vscode.Progress<{ message?: string; increment?: number }>;
    private readonly token?: vscode.CancellationToken;

    private processed = 0;
    private totalItems = 0; // for progress % calculation

    constructor(
        cfg: StructureConfig,
        progress?: vscode.Progress<{ message?: string; increment?: number }>,
        token?: vscode.CancellationToken
    ) {
        // Fill every optional flag with a concrete default – makes the rest
        // of the code simpler (no long `if (cfg.xxx ?? false)` everywhere).
        this.cfg = {
            includeHidden: cfg.includeHidden ?? false,
            extensionFilter: cfg.extensionFilter ?? null,
            excludeFolders: cfg.excludeFolders ?? null,
            excludePatterns: cfg.excludePatterns ?? null,
            maxDepth: cfg.maxDepth ?? 0,               // 0 = unlimited
            respectGitignore: cfg.respectGitignore ?? true,
            includeSize: cfg.includeSize ?? false,
            includePermissions: cfg.includePermissions ?? false,
            includeModifiedDate: cfg.includeModifiedDate ?? false,
            sortBy: cfg.sortBy ?? 'name',
            outputFormat: cfg.outputFormat ?? 'tree',
            useWorker: cfg.useWorker ?? false,
            iconStyle: cfg.iconStyle ?? 'emoji',
            customIcons: cfg.customIcons ?? {},
            compressLargeDirs: cfg.compressLargeDirs ?? true,
            compressionThreshold: cfg.compressionThreshold ?? 50,
            autoSave: cfg.autoSave ?? true,
            autoOpen: cfg.autoOpen ?? true
        };

        this.progress = progress;
        this.token = token;
    }

    /** Public entry – returns **already formatted** text (tree / json / …) */
    async generate(rootPath: string): Promise<string> {
        // -------------------------------------------------------------
        // 1️⃣  Compute a rough item count first (for a decent progress bar)
        // -------------------------------------------------------------
        if (this.progress) {
            this.totalItems = await this.countItems(rootPath);
        }

        // -------------------------------------------------------------
        // 2️⃣  Build the in‑memory tree
        // -------------------------------------------------------------
        const start = Date.now();
        const root = await this.buildTree(rootPath, 0);
        const generationTime = Date.now() - start;

        PerformanceMonitor.getInstance().recordOperation(
            'generateStructure',
            generationTime
        );

        // -------------------------------------------------------------
        // 3️⃣  Format the result according to the selected outputFormat
        // -------------------------------------------------------------
        return this.formatOutput(root, generationTime);
    }

    /* -----------------------------------------------------------------
       1️⃣  COUNT ITEMS (used only for the progress bar)
       ----------------------------------------------------------------- */
    private async countItems(dir: string, depth = 0): Promise<number> {
        if (this.cfg.maxDepth && depth >= this.cfg.maxDepth) {
            return 0;
        }
        if (this.token?.isCancellationRequested) {
            return 0;
        }
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            let count = entries.length;

            for (const e of entries) {
                if (e.isDirectory()) {
                    // Basic filter - skip hidden and excluded folders
                    const shouldSkip =
                        (!this.cfg.includeHidden && e.name.startsWith('.')) ||
                        (this.cfg.excludeFolders && this.cfg.excludeFolders.includes(e.name));

                    if (!shouldSkip) {
                        count += await this.countItems(path.join(dir, e.name), depth + 1);
                    }
                }
            }
            return count;
        } catch {
            return 0;
        }
    }

    /* -----------------------------------------------------------------
       2️⃣  BUILD THE TREE (recursive)
       ----------------------------------------------------------------- */
    private async buildTree(dir: string, depth: number): Promise<FileEntry> {
        // cancellation check – allows the UI “Cancel” button to abort fast
        if (this.token?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        // depth limit (0 = unlimited)
        if (this.cfg.maxDepth && depth >= this.cfg.maxDepth) {
            return {
                name: path.basename(dir) || dir,
                path: dir,
                type: 'directory',
                children: [] // collapsed
            };
        }

        const entry: FileEntry = {
            name: path.basename(dir) || dir,
            path: dir,
            type: 'directory',
            children: []
        };

        // -----------------------------------------------------------------
        // OPTIONAL METADATA (size / permissions / modified)
        // -----------------------------------------------------------------
        if (this.cfg.includeSize || this.cfg.includePermissions || this.cfg.includeModifiedDate) {
            const stats = await this.getStats(dir);
            if (stats) {
                entry.size = stats.size;
                if (this.cfg.includePermissions) {
                    entry.permissions = this.permissionsString(stats.mode);
                }
                if (this.cfg.includeModifiedDate) {
                    entry.modified = stats.mtime;
                }
            }
        }

        // -----------------------------------------------------------------
        // READ DIR CONTENTS + APPLY ALL FILTERS
        // -----------------------------------------------------------------
        const rawItems = await fs.promises.readdir(dir, { withFileTypes: true });
        const filtered = await this.filterAndSort(rawItems, dir);

        for (let i = 0; i < filtered.length; i++) {
            const item = filtered[i];
            const itemPath = path.join(dir, item.name);

            // progress update
            this.processed++;
            if (this.progress && this.totalItems) {
                const pct = Math.round((this.processed / this.totalItems) * 100);
                this.progress.report({
                    message: `Processing ${item.name} (${pct} %)`,
                    increment: 1
                });
            }

            // -----------------------------------------------------------------
            // CREATE FILE/DIR entry
            // -----------------------------------------------------------------
            const child: FileEntry = {
                name: item.name,
                path: itemPath,
                type: item.isDirectory()
                    ? 'directory'
                    : item.isSymbolicLink()
                        ? 'symlink'
                        : 'file'
            };

            // per‑item metadata (if requested)
            if (this.cfg.includeSize || this.cfg.includePermissions || this.cfg.includeModifiedDate) {
                const stats = await this.getStats(itemPath);
                if (stats) {
                    child.size = stats.size;
                    if (this.cfg.includePermissions) {
                        child.permissions = this.permissionsString(stats.mode);
                    }
                    if (this.cfg.includeModifiedDate) {
                        child.modified = stats.mtime;
                    }
                }
            }

            // recursion for sub‑folders
            if (item.isDirectory()) {
                child.children = (await this.buildTree(itemPath, depth + 1)).children;
            }

            // plug‑in hook (if anybody registers a plugin)
            entry.children!.push(PluginManager.getInstance().processEntry(child));
        }

        // -----------------------------------------------------------------
        // FINAL SORT (if a sortBy other than name is requested)
        // -----------------------------------------------------------------
        if (this.cfg.sortBy) {
            this.sortEntries(entry.children!);
        }

        return entry;
    }

    /* -----------------------------------------------------------------
       FILTERING & SORTING
       ----------------------------------------------------------------- */
    private async filterAndSort(
        items: fs.Dirent[],
        parentPath: string
    ): Promise<fs.Dirent[]> {
        // ---- hidden files -------------------------------------------------
        let out = items.filter(i =>
            this.cfg.includeHidden || !i.name.startsWith('.')
        );

        // ---- folder exclusion list ----------------------------------------
        if (this.cfg.excludeFolders) {
            out = out.filter(i =>
                !(i.isDirectory() && this.cfg.excludeFolders!.includes(i.name))
            );
        }

        // ---- extension whitelist -------------------------------------------
        if (this.cfg.extensionFilter && out.some(i => i.isFile())) {
            out = out.filter(i =>
                i.isFile()
                    ? this.cfg.extensionFilter!.includes(
                        path.extname(i.name).slice(1).toLowerCase()
                    )
                    : true
            );
        }

        // ---- glob‑pattern exclusions ---------------------------------------
        if (this.cfg.excludePatterns) {
            out = out.filter(i => {
                const full = path.join(parentPath, i.name);
                return !this.cfg.excludePatterns!.some(p => this.matchesPattern(full, p));
            });
        }

        // ---- .gitignore handling -------------------------------------------
        if (this.cfg.respectGitignore) {
            const rules = await this.gitignoreRules(parentPath);
            if (rules) {
                out = out.filter(i => {
                    const full = path.join(parentPath, i.name);
                    return !rules.isIgnored(full);
                });
            }
        }

        // ---- final sort ----------------------------------------------------
        out.sort((a, b) => {
            // directories first (unless sortBy is something else)
            if (this.cfg.sortBy === 'name') {
                if (a.isDirectory() && !b.isDirectory()) { return -1; }
                if (!a.isDirectory() && b.isDirectory()) { return 1; }
                return a.name.localeCompare(b.name, undefined, { numeric: true });
            }
            // other sorts are applied after the whole tree is built
            return 0;
        });

        return out;
    }

    /* -----------------------------------------------------------------
       HELPERS – GITIGNORE, STATS, PERMISSIONS, GLOB MATCHES
       ----------------------------------------------------------------- */
    private async gitignoreRules(dir: string): Promise<GitignoreRules | null> {
        if (gitignoreCache.has(dir)) {
            return gitignoreCache.get(dir)!;
        }
        const nearest = await this.findNearestGitignore(dir);
        if (!nearest) {
            return null;
        }  
        const content = await fs.promises.readFile(nearest, 'utf8');
        const patterns = content
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'));

        const rules: GitignoreRules = {
            patterns,
            isIgnored: (filePath: string) => {
                const rel = path.relative(path.dirname(nearest), filePath);
                return patterns.some(p => this.matchesPattern(rel, p));
            }
        };
        gitignoreCache.set(dir, rules);
        return rules;
    }

    private async findNearestGitignore(start: string): Promise<string | null> {
        let cur = start;
        while (cur && cur !== path.dirname(cur)) {
            const candidate = path.join(cur, '.gitignore');
            try {
                await fs.promises.access(candidate);
                return candidate;
            } catch {
                // keep climbing
                cur = path.dirname(cur);
            }
        }
        return null;
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Very small glob → RegExp conversion (supports **, *, ?)
        const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const regex = '^' + esc
            .replace(/\\\*\\\*/g, '.*')
            .replace(/\\\*/g, '[^/]*')
            .replace(/\\\?/g, '[^/]')
            + '$';
        return new RegExp(regex).test(filePath);
    }

    private async getStats(p: string): Promise<fs.Stats | null> {
        if (statsCache.has(p)) {
            return statsCache.get(p)!;
        }
        try {
            const st = await fs.promises.stat(p);
            statsCache.set(p, st);
            return st;
        } catch {
            return null;
        }
    }

    private permissionsString(mode: number): string {
        const map = ['r', 'w', 'x'];
        let str = '';
        for (let i = 8; i >= 0; i--) {
            str += (mode & (1 << i)) ? map[(8 - i) % 3] : '-';
        }
        return str;
    }

    /* -----------------------------------------------------------------
       SORTING (size / modified / type)
       ----------------------------------------------------------------- */
    private sortEntries(entries: FileEntry[]) {
        entries.sort((a, b) => {
            // directories always first (unless sortBy = 'type')
            if (a.type === 'directory' && b.type !== 'directory') { return -1; }
            if (a.type !== 'directory' && b.type === 'directory') { return 1;  }

            switch (this.cfg.sortBy) {
                case 'size':
                    return (b.size ?? 0) - (a.size ?? 0);
                case 'modified':
                    return (b.modified?.getTime() ?? 0) - (a.modified?.getTime() ?? 0);
                case 'type':
                    return a.type.localeCompare(b.type);
                default:
                    return a.name.localeCompare(b.name, undefined, { numeric: true });
            }
        });

        // recurse
        for (const e of entries) {
            if (e.children) {
                this.sortEntries(e.children);
            }
        }
    }

    /* -----------------------------------------------------------------
       FORMATTING (tree, json, markdown, xml, csv)
       ----------------------------------------------------------------- */
    private formatOutput(root: FileEntry, genTime: number): string {
        switch (this.cfg.outputFormat) {
            case 'json':
                return this.formatJSON(root, genTime);
            case 'markdown':
                return this.formatMarkdown(root, genTime);
            case 'xml':
                return this.formatXML(root, genTime);
            case 'csv':
                return this.formatCSV(root);
            default:
                return this.formatTree(root, '', genTime);
        }
    }

    /* --------------------------- TREE --------------------------- */
    private formatTree(entry: FileEntry, prefix = '', genTime?: number): string {
        // Header for the root node (once)
        let out = '';
        if (!prefix) {
            out += `📁 ${entry.name}\n`;
            if (genTime !== undefined) {
                out += `⏱️  Generated in ${genTime} ms\n`;
            }
            out += '─'.repeat(50) + '\n';
        }

        if (!entry.children?.length) { return out; }

        for (let i = 0; i < entry.children.length; i++) {
            const child = entry.children[i];
            const isLast = i === entry.children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const subPrefix = isLast ? '    ' : '│   ';

            const icon = this.getIcon(child);
            let line = `${prefix}${connector}${icon}${child.name}`;

            // optional metadata
            if (this.cfg.includeSize && child.size !== undefined) {
                line += ` (${this.humanFileSize(child.size)})`;
            }
            if (this.cfg.includePermissions && child.permissions) {
                line += ` [${child.permissions}]`;
            }
            if (this.cfg.includeModifiedDate && child.modified) {
                line += ` ⏰ ${child.modified.toISOString().split('T')[0]}`;
            }

            out += line + '\n';

            // recurse
            if (child.children && child.children.length) {
                // Compression – collapse huge directories if requested
                if (this.cfg.compressLargeDirs && child.children.length > this.cfg.compressionThreshold!) {
                    out += `${prefix}${subPrefix}… (${child.children.length} items, collapsed)\n`;
                } else {
                    out += this.formatTree(child, prefix + subPrefix);
                }
            }
        }
        return out;
    }

    /* --------------------------- JSON --------------------------- */
    private formatJSON(entry: FileEntry, genTime: number): string {
        const meta = {
            generatedAt: new Date().toISOString(),
            generationTime: `${genTime}ms`,
            itemsProcessed: this.processed,
            config: this.cfg
        };
        return JSON.stringify({ meta, structure: entry }, null, 2);
    }

    /* --------------------------- MARKDOWN --------------------------- */
    private formatMarkdown(entry: FileEntry, genTime: number): string {
        let md = `# 📁 ${entry.name}\n\n`;
        md += `**Generated:** ${new Date().toISOString()}\n`;
        md += `**Generation time:** ${genTime} ms\n`;
        md += `**Items processed:** ${this.processed}\n\n`;
        md += '## Directory tree\n```\n';
        md += this.formatTree(entry);
        md += '```\n';
        return md;
    }

    /* --------------------------- XML --------------------------- */
    private formatXML(entry: FileEntry, genTime: number): string {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<folderStructure generated="${new Date().toISOString()}" timeMs="${genTime}">\n`;
        xml += this.xmlNode(entry, 1);
        xml += `</folderStructure>\n`;
        return xml;
    }

    private xmlNode(node: FileEntry, indent: number): string {
        const pad = '  '.repeat(indent);
        const attrs = [
            `name="${node.name}"`,
            `type="${node.type}"`,
            node.size !== undefined ? `size="${node.size}"` : '',
            node.permissions ? `perm="${node.permissions}"` : '',
            node.modified ? `mod="${node.modified.toISOString()}"` : ''
        ]
            .filter(Boolean)
            .join(' ');
        if (!node.children?.length) {
            return `${pad}<node ${attrs} />\n`;
        }
        let out = `${pad}<node ${attrs}>\n`;
        for (const child of node.children) {
            out += this.xmlNode(child, indent + 1);
        }
        out += `${pad}</node>\n`;
        return out;
    }

    /* --------------------------- CSV --------------------------- */
    private formatCSV(root: FileEntry): string {
        // Columns: path, type, size, permissions, modified
        const rows: string[] = [
            ['Path', 'Type', 'Size (bytes)', 'Permissions', 'Modified'].join(',')
        ];
        const walk = (node: FileEntry) => {
            const row = [
                `"${node.path}"`,
                node.type,
                node.size?.toString() ?? '',
                node.permissions ?? '',
                node.modified?.toISOString() ?? ''
            ].join(',');
            rows.push(row);
            node.children?.forEach(walk);
        };
        walk(root);
        return rows.join('\n');
    }

    /* -----------------------------------------------------------------
       ICON HELPERS (emoji / unicode / ascii / none) + custom mapping
       ----------------------------------------------------------------- */
    private getIcon(entry: FileEntry): string {
        if (this.cfg.iconStyle === 'none') {
            return '';
        }

        // 1️⃣ custom icons supplied by the user (extension → icon)
        if (this.cfg.customIcons) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext && this.cfg.customIcons[ext]) {
                return this.cfg.customIcons[ext] + ' ';
            }
        }

        // 2️⃣ built‑in map – covers most common file types
        const emojiMap: Record<string, string> = {
            directory: '📁',
            file: '📄',
            symlink: '🔗',
            '.js': '🟨',
            '.ts': '🔷',
            '.json': '🗒️',
            '.md': '📝',
            '.txt': '📃',
            '.yml': '⚙️',
            '.yaml': '⚙️',
            '.xml': '🗂️',
            '.html': '🌐',
            '.css': '🎨',
            '.scss': '🎨',
            '.py': '🐍',
            '.java': '☕',
            '.c': '⚡',
            '.cpp': '⚡',
            '.go': '🐹',
            '.rs': '🦀',
            '.php': '🐘',
            '.sh': '🐚',
            '.dockerfile': '🐳'
        };
        const defaultEmoji = this.cfg.iconStyle === 'emoji' ? '📄' : this.cfg.iconStyle === 'unicode' ? '📄' : this.cfg.iconStyle === 'ascii' ? '[F]' : '';

        const key = entry.type === 'directory'
            ? 'directory'
            : entry.type === 'symlink'
                ? 'symlink'
                : path.extname(entry.name).toLowerCase();

        return (emojiMap[key] || defaultEmoji) + ' ';
    }

    private humanFileSize(bytes: number): string {
        if (bytes === 0)  {return '0 B'; }
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const num = (bytes / Math.pow(1024, i)).toFixed(1);
        return `${num} ${units[i]}`;
    }
}

/* ==================================================================
   USER‑INTERFACE HELPERS – SETTINGS, Wizards, etc.
   ================================================================== */

/**
 * Pull all settings from the workspace (or user) configuration.
 * The names **must** match what you expose in `package.json`.
 */
async function getConfigFromSettings(): Promise<StructureConfig> {
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
        iconStyle: cfg.get<'emoji' | 'unicode' | 'ascii' | 'none'>('iconStyle') ?? 'emoji',
        customIcons: cfg.get<Record<string, string>>('customIcons') ?? {},
        compressLargeDirs: cfg.get<boolean>('compressLargeDirs') ?? true,
        compressionThreshold: cfg.get<number>('compressionThreshold') ?? 50,
        autoSave: cfg.get<boolean>('autoSave') ?? true,
        autoOpen: cfg.get<boolean>('autoOpen') ?? true
    };
}

/**
 * Step‑by‑step UI wizard (called from the *interactive* command)
 */
async function showAdvancedConfigurationWizard(): Promise<StructureConfig | null> {
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
    if (!filterMode) { return null;  }

    if (filterMode.value === 'extensions') {
        const txt = await vscode.window.showInputBox({
            prompt: 'Comma‑separated list of extensions (e.g. js,ts,json)',
            validateInput: v => v && /^[a-zA-Z0-9,.\s]+$/.test(v) ? null : 'Invalid list'
        });
        if (txt) {
            cfg.extensionFilter = txt.split(',').map(s => s.trim().replace(/^\./, '').toLowerCase());
        }
    } else if (filterMode.value === 'exclude') {
        const txt = await vscode.window.showInputBox({
            prompt: 'Comma‑separated glob patterns to exclude (e.g. *.log,temp/**,test/*)'
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
    if (!fmt) { return null; }
    cfg.outputFormat = fmt.value as any;

    // ---- step 4 : depth & icons --------------------------------------
    const depthStr = await vscode.window.showInputBox({
        prompt: 'Maximum traversal depth (0 = unlimited, default = 10)',
        value: '10',
        validateInput: v => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 0 ? null : 'Enter a non‑negative integer';
        }
    });
    if (depthStr) {cfg.maxDepth = Number(depthStr) || undefined;}

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

    // ---- step 5 : compression & auto‑behaviour ----------------------
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
        validateInput: v => Number.isInteger(Number(v)) && Number(v) >= 0 ? null : 'Enter a non‑negative integer'
    });
    cfg.compressionThreshold = thresholdStr ? Number(thresholdStr) : 50;

    const autoSave = await vscode.window.showQuickPick(
        [
            { label: '💾 Auto‑save after generation', value: true },
            { label: '🛑 Do **not** auto‑save (prompt later)', value: false }
        ],
        { placeHolder: 'Auto‑save?' }
    );
    cfg.autoSave = autoSave?.value ?? true;

    const autoOpen = await vscode.window.showQuickPick(
        [
            { label: '📂 Auto‑open the generated file', value: true },
            { label: '🚪 Do **not** auto‑open', value: false }
        ],
        { placeHolder: 'Auto‑open?' }
    );
    cfg.autoOpen = autoOpen?.value ?? true;

    return cfg as StructureConfig;
}

/**
 * Utility – quick check that a path really is a folder.
 */
async function isValidDirectory(p: string): Promise<boolean> {
    try {
        const s = await fs.promises.stat(p);
        return s.isDirectory();
    } catch {
        return false;
    }
}

/**
 * Save the generated text to disk and (optionally) open it.
 */
async function saveAndPresentResults(
    rootFolder: string,
    content: string,
    cfg: StructureConfig
) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = cfg.outputFormat === 'tree' ? 'txt' : cfg.outputFormat;
    const fileName = `structure_${stamp}.${ext}`;
    const filePath = path.join(rootFolder, fileName);

    await fs.promises.writeFile(filePath, content, 'utf8');

    const actions = ['Copy to Clipboard'];
    if (cfg.autoOpen) {actions.unshift('Open File');}
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

/* ==================================================================
   OTHER COMMAND IMPLEMENTATIONS (compare, export, batch, ai, …)
   ================================================================== */

async function compareDirectoryStructures() {
    const panes = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: 'Select two folders to compare'
    });
    if (!panes || panes.length !== 2) {
        vscode.window.showErrorMessage('Please pick **exactly two** folders.');
        return;
    }

    const [a, b] = panes;
    const cfg: StructureConfig = {
        includeSize: true,
        sortBy: 'name',
        outputFormat: 'tree'
    };

    const progressOpts = {
        location: vscode.ProgressLocation.Notification,
        title: 'Comparing folders…',
        cancellable: true
    };

    await vscode.window.withProgress(progressOpts, async (progress, token) => {
        progress.report({ message: `Scanning ${a.fsPath}` });
        const genA = new StructureGenerator(cfg);
        const structA = await genA.generate(a.fsPath);

        if (token.isCancellationRequested)  {return; }

        progress.report({ message: `Scanning ${b.fsPath}` });
        const genB = new StructureGenerator(cfg);
        const structB = await genB.generate(b.fsPath);

        const report = [
            `# 📁 Directory Comparison`,
            `**Folder 1:** \`${a.fsPath}\``,
            `**Folder 2:** \`${b.fsPath}\``,
            '',
            `## 📂 ${path.basename(a.fsPath)}`,
            '```',
            structA,
            '```',
            '',
            `## 📂 ${path.basename(b.fsPath)}`,
            '```',
            structB,
            '```',
            '',
            '_Generated by Folder Structure Navigator_'
        ].join('\n');

        const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.parse('untitled:directory‑compare.md')
        );
        const editor = await vscode.window.showTextDocument(doc);
        await editor.edit(e => e.insert(new vscode.Position(0, 0), report));
    });
}

/**
 * Export (quick‑pick) – the user can choose a format *after* the
 * folder was selected.  The command respects the current config for
 * everything else (size, permissions, …) but overrides the output
 * format with the user’s choice.
 */
async function exportStructureCommand(uri: vscode.Uri) {
    if (!uri || !(await isValidDirectory(uri.fsPath))) {
        vscode.window.showErrorMessage('Select a valid folder first.');
        return;
    }

    const format = await vscode.window.showQuickPick(
        ['Tree View', 'JSON', 'Markdown', 'XML', 'CSV'],
        { placeHolder: 'Export format' }
    );
    if (!format) { return; }

    const cfg = await getConfigFromSettings();
    cfg.outputFormat = format.toLowerCase().replace(' view', '') as any;

    const gen = new StructureGenerator(cfg);
    const result = await gen.generate(uri.fsPath);

    const outPath = path.join(uri.fsPath, `exported_structure.${cfg.outputFormat}`);
    await fs.promises.writeFile(outPath, result, 'utf8');
    vscode.window.showInformationMessage(`Structure exported to ${outPath}`);
}

/**
 * Simple performance‑report viewer (markdown)
 */
async function showPerformanceReportCommand() {
    const rep = PerformanceMonitor.getInstance().getMetricsReport();
    const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse('untitled:performance‑report.md')
    );
    const ed = await vscode.window.showTextDocument(doc);
    await ed.edit(e => e.insert(new vscode.Position(0, 0), rep));
}

/**
 * Template wizard – list / save / load / delete
 */
async function manageTemplatesCommand() {
    const action = await vscode.window.showQuickPick(
        [
            { label: '📜 List templates', id: 'list' },
            { label: '💾 Save current config as template', id: 'save' },
            { label: '📂 Load a template', id: 'load' },
            { label: '🗑️ Delete a template', id: 'delete' }
        ],
        { placeHolder: 'Template action' }
    );
    if (!action) { return; }

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

/**
 * Batch processing – generate a report for many folders in one go.
 */
async function batchProcessCommand() {
    const dirs = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: 'Select folders for batch processing'
    });
    if (!dirs?.length) { return; }

    const cfg = await showAdvancedConfigurationWizard();
    if (!cfg) { return; }

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
                const gen = new StructureGenerator(cfg);
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
            vscode.Uri.parse('untitled:batch‑report.md')
        );
        const ed = await vscode.window.showTextDocument(doc);
        await ed.edit(e => e.insert(new vscode.Position(0, 0), report));
    });
}

/**
 * “Generate with AI analysis” (the *heuristic* analyser we already
 * have in the source file) – the same code you already shipped, just
 * wrapped in the correct UI flow.
 */
async function generateWithAnalysisCommand(uri: vscode.Uri) {
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
        const gen = new StructureGenerator(cfg, progress, token);
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
        const outPath = path.join(uri.fsPath, `structure‑analysis_${ts}.md`);
        await fs.promises.writeFile(outPath, finalReport, 'utf8');

        const doc = await vscode.workspace.openTextDocument(outPath);
        await vscode.window.showTextDocument(doc);
    });
}

/* --------------------------------------------------------------
   PRESET HANDLER (minimal / detailed / documentation / development)
   -------------------------------------------------------------- */
async function applyPreset(presetName: string) {
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
   TEMPLATE HELPERS (list / save / load / delete)
   ================================================================== */
async function listTemplates() {
    const wsTemplates = await WorkspaceIntegration.loadWorkspaceTemplates();
    const globalTemplates = TemplateEngine.listTemplates();

    let txt = '# 📚 Available templates\n\n';

    if (Object.keys(wsTemplates).length) {
        txt += '## Workspace templates\n';
        for (const [n, cfg] of Object.entries(wsTemplates)) {
            txt += `- **${n}** (format: ${cfg.outputFormat ?? 'tree'}, depth: ${cfg.maxDepth ?? '∞'})\n`;
        }
        txt += '\n';
    }

    if (globalTemplates.length) {
        txt += '## Global templates (built‑in)\n';
        txt += globalTemplates.map(t => `- ${t}`).join('\n') + '\n';
    }

    const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse('untitled:templates.md')
    );
    const ed = await vscode.window.showTextDocument(doc);
    await ed.edit(e => e.insert(new vscode.Position(0, 0), txt));
}

async function saveCurrentConfigAsTemplate() {
    const name = await vscode.window.showInputBox({
        prompt: 'Template name',
        validateInput: v => v && /^[a-zA-Z0-9_-]+$/.test(v) ? null : 'Alphanumerics, “_” and “-” only.'
    });
    if (!name) {return;}

    const cfg = await getConfigFromSettings();
    await WorkspaceIntegration.saveWorkspaceTemplate(name, cfg);
}

async function loadTemplate() {
    const wsTemplates = await WorkspaceIntegration.loadWorkspaceTemplates();
    const choice = await vscode.window.showQuickPick(
        Object.keys(wsTemplates).map(k => ({ label: k, detail: wsTemplates[k].outputFormat })),
        { placeHolder: 'Select a template to load' }
    );
    if (!choice) {return;}

    const cfg = wsTemplates[choice.label];
    const ws = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');

    for (const [k, v] of Object.entries(cfg)) {
        await ws.update(k, v, vscode.ConfigurationTarget.Workspace);
    }
    vscode.window.showInformationMessage(`Template **${choice.label}** loaded.`);
}

async function deleteTemplate() {
    const wsTemplates = await WorkspaceIntegration.loadWorkspaceTemplates();
    const choice = await vscode.window.showQuickPick(
        Object.keys(wsTemplates),
        { placeHolder: 'Select a template to delete' }
    );
    if (!choice) {return;}

    const confirm = await vscode.window.showWarningMessage(
        `Delete template **${choice}**?`,
        { modal: true },
        'Delete'
    );
    if (confirm !== 'Delete') {return;}

    delete wsTemplates[choice];
    const wsFolders = vscode.workspace.workspaceFolders;
    if (wsFolders?.length) {
        const file = path.join(wsFolders[0].uri.fsPath, '.vscode', 'folder-navigator-templates.json');
        await fs.promises.writeFile(file, JSON.stringify(wsTemplates, null, 2), 'utf8');
        vscode.window.showInformationMessage(`Template **${choice}** deleted.`);
    }
}

/* ==================================================================
   “AI” ANALYSIS (still heuristic, not a real LLM call)
   ================================================================== */
function analyzeProjectStructure(rootPath: string, structure: string): string {
    // (the same implementation you already had – unchanged)
    // … (omitted for brevity – copy‑paste the functions you already
    // have: detectProjectType, findStructureIssues, generateRecommendations,
    // detectTechnologies) …
    // For the final code‑copy you just keep the implementations
    // that exist further down in the original source file.
    // --------------------------------------------------------------
    const projectName = path.basename(rootPath);
    const lines = structure.split('\n').filter(l => l.trim());

    const fileCount = lines.filter(l => l.includes('📄')).length;
    const dirCount = lines.filter(l => l.includes('📁')).length;
    const maxDepth = Math.max(
        ...lines.map(l => {
            const m = l.match(/^(\s*)/);
            return m ? Math.floor(m[1].length / 4) : 0;
        })
    );

    const type = detectProjectType(structure);
    const issues = findStructureIssues(structure);
    const recs = generateRecommendations(structure, type);
    const tech = detectTechnologies(structure);

    return [
        '## 📊 Project analysis',
        `- **Name:** ${projectName}`,
        `- **Files:** ${fileCount}`,
        `- **Directories:** ${dirCount}`,
        `- **Depth:** ${maxDepth}`,
        `- **Detected type:** ${type}`,
        '',
        '### ⚠️ Issues',
        issues.length ? issues.map(i => `- ${i}`).join('\n') : 'None',
        '',
        '### 💡 Recommendations',
        recs.map(r => `- ${r}`).join('\n'),
        '',
        '### 🛠️ Detected technologies',
        tech.length ? tech.map(t => `- ${t}`).join('\n') : 'None',
        '',
        '_Generated by Folder Structure Navigator (heuristic analysis)_'
    ].join('\n');
}

/* --------------------------------------------------------------
   PERFORMANCE MONITOR (unchanged)
   -------------------------------------------------------------- */
class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics = new Map<string, number[]>();
    private readonly maxSamples = 100;

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    recordOperation(name: string, durationMs: number) {
        if (!this.metrics.has(name)) {this.metrics.set(name, []);}
        const arr = this.metrics.get(name)!;
        arr.push(durationMs);
        if (arr.length > this.maxSamples) {arr.splice(0, arr.length - this.maxSamples);}
    }

    getMetricsReport(): string {
        let txt = '# 📈 Performance metrics\n\n';
        for (const [op, values] of this.metrics.entries()) {
            const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
            const min = Math.min(...values);
            const max = Math.max(...values);
            txt += `## ${op}\n- Avg: ${avg} ms\n- Min: ${min} ms\n- Max: ${max} ms\n- Samples: ${values.length}\n\n`;
        }
        return txt;
    }
}

/* --------------------------------------------------------------
   CACHE (unchanged)
   -------------------------------------------------------------- */
class AdvancedCache {
    private static instance: AdvancedCache;
    private cache = new Map<string, { data: any; ts: number; ttl: number }>();
    private readonly defaultTTL = 5 * 60 * 1000; // 5 min

    static getInstance(): AdvancedCache {
        if (!AdvancedCache.instance) {AdvancedCache.instance = new AdvancedCache();}
        return AdvancedCache.instance;
    }

    set(key: string, data: any, ttl = this.defaultTTL) {
        this.cache.set(key, { data, ts: Date.now(), ttl });
        // occasional cleanup
        if (this.cache.size % 40 === 0) {this.cleanup();}
    }

    get(key: string) {
        const rec = this.cache.get(key);
        if (!rec) {return null;}
        if (Date.now() - rec.ts > rec.ttl) {
            this.cache.delete(key);
            return null;
        }
        return rec.data;
    }

    has(key: string) {
        return this.get(key) !== null;
    }

    delete(key: string) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    private cleanup() {
        const now = Date.now();
        for (const [k, r] of this.cache.entries()) {
            if (now - r.ts > r.ttl) {this.cache.delete(k);}
        }
    }

    getCacheStats() {
        return { size: this.cache.size, hitRate: 0 };
    }
}

/* --------------------------------------------------------------
   PLUGIN MANAGER (unchanged – kept for future extensibility)
   -------------------------------------------------------------- */
class PluginManager {
    private static instance: PluginManager;
    private plugins = new Map<string, StructurePlugin>();

    static getInstance(): PluginManager {
        if (!PluginManager.instance) {PluginManager.instance = new PluginManager();}
        return PluginManager.instance;
    }

    registerPlugin(p: StructurePlugin) {
        this.plugins.set(p.name, p);
        console.log(`🔌 Plugin registered: ${p.name}@${p.version}`);
    }

    getPlugin(name: string) {
        return this.plugins.get(name);
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    /** Let every plugin mutate a FileEntry before it is stored */
    processEntry(entry: FileEntry): FileEntry {
        let out = entry;
        for (const pl of this.plugins.values()) {
            if (pl.processEntry) {
                out = pl.processEntry(out);
            }
        }
        return out;
    }

    /** Let plugins post‑process the final string output */
    formatOutput(struct: string, fmt: string): string {
        let out = struct;
        for (const pl of this.plugins.values()) {
            if (pl.formatOutput) {
                out = pl.formatOutput(out, fmt);
            }
        }
        return out;
    }
}

/* --------------------------------------------------------------
   WORKSPACE INTEGRATION – reading / writing *.vscode* files
   -------------------------------------------------------------- */
class WorkspaceIntegration {
    /** Load the `.vscode/folder-navigator-templates.json` file if present */
    static async loadWorkspaceTemplates(): Promise<Record<string, StructureConfig>> {
        const ws = vscode.workspace.workspaceFolders;
        if (!ws?.length) { return {}; }

        const file = path.join(ws[0].uri.fsPath, '.vscode', 'folder-navigator-templates.json');
        try {
            const data = await fs.promises.readFile(file, 'utf8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    /** Write (or update) a template inside the workspace's JSON file */
    static async saveWorkspaceTemplate(name: string, cfg: StructureConfig): Promise<void> {
        const ws = vscode.workspace.workspaceFolders;
        if (!ws?.length) {throw new Error('No workspace folder');}

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
}

/* --------------------------------------------------------------
   TEMPLATE ENGINE (global built‑in templates – unchanged)
   -------------------------------------------------------------- */
class TemplateEngine {
    private static templates = new Map<string, string>([
        ['minimal', `{name}\n├── {children}`],
        [
            'detailed',
            `{icon} {name} ({size}) [${'{permissions}'}] {modified}\n├── {children}`
        ],
        [
            'report',
            `# Project Structure Report\n\n**Project:** {name}\n**Generated:** {timestamp}\n\n## Tree\n{tree}`
        ]
    ]);

    static registerTemplate(name: string, tmpl: string) {
        this.templates.set(name, tmpl);
    }

    static getTemplate(name: string) {
        return this.templates.get(name) ?? null;
    }

    static listTemplates() {
        return Array.from(this.templates.keys());
    }

    static render(name: string, data: Record<string, any>) {
        const tmpl = this.getTemplate(name);
        if (!tmpl) { return ''; }
        let out = tmpl;
        for (const [k, v] of Object.entries(data)) {
            out = out.replace(new RegExp(`{${k}}`, 'g'), String(v));
        }
        return out;
    }
}

/* --------------------------------------------------------------
   ANALYSIS HELPERS – kept exactly as you posted (detectProjectType,
   findStructureIssues, generateRecommendations, detectTechnologies)
   -------------------------------------------------------------- */
// (COPY‑PASTE the four helper functions from the original source
// below this comment – they are unchanged.)

function detectProjectType(structure: string): string {
    const indicators: Record<string, string[]> = {
        'React/Next.js': ['package.json', 'src/', 'public/', 'components/', 'pages/', 'next.config'],
        'Vue.js': ['package.json', 'src/', 'components/', 'vue.config', '.vue'],
        'Angular': ['package.json', 'src/', 'angular.json', 'tsconfig.json'],
        'Node.js API': ['package.json', 'server', 'routes/', 'controllers/', 'middleware/'],
        'Python': ['requirements.txt', 'setup.py', '__pycache__/', '.py'],
        'Java/Maven': ['pom.xml', 'src/main/java', 'target/'],
        'Java/Gradle': ['build.gradle', 'src/main/java', 'gradle/'],
        'C++': ['.cpp', '.hpp', '.h', 'CMakeLists.txt', 'Makefile'],
        'Go': ['go.mod', 'main.go', '.go'],
        'Rust': ['Cargo.toml', 'src/', '.rs'],
        '.NET': ['.csproj', '.sln', 'bin/', 'obj/'],
        'Documentation': ['README', 'docs/', '.md', 'mkdocs'],
        'Static Site': ['index.html', '_site/', '.jekyll', 'hugo']
    };
    for (const [type, pats] of Object.entries(indicators)) {
        const hits = pats.filter(p => structure.includes(p)).length;
        if (hits >= Math.ceil(pats.length * 0.4)) { return type; }
    }
    return 'Unknown/Mixed';
}

function findStructureIssues(structure: string): string[] {
    const issues: string[] = [];
    const lines = structure.split('\n');

    // deep nesting
    const deep = lines.filter(l => {
        const m = l.match(/^(\s*)/);
        return m && Math.floor(m[1].length / 4) > 8;
    });
    if (deep.length) {issues.push(`Very deep nesting (${deep.length} items deeper than 8 levels)`);}

    // missing common files
    const common = ['README', 'LICENSE', '.gitignore'];
    const missing = common.filter(f => !structure.toLowerCase().includes(f.toLowerCase()));
    if (missing.length) {issues.push(`Missing common files: ${missing.join(', ')}`);}

    // potential secret files
    const secrets = ['.env', '.key', '.pem', 'password', 'secret'];
    const found = secrets.filter(s => structure.toLowerCase().includes(s));
    if (found.length) {issues.push(`Potentially sensitive files detected: ${found.join(', ')}`);}

    return issues;
}

function generateRecommendations(structure: string, projType: string): string[] {
    const recs: string[] = [];

    if (!structure.includes('README')) {
        recs.push('Add a README.md to describe the project.');
    }
    if (!structure.includes('.gitignore')) {
        recs.push('Create a .gitignore file.');
    }
    if (projType === 'React/Next.js') {
        if (!structure.includes('.eslintrc')) {
            recs.push('Add ESLint configuration.');
        }
        if (!structure.includes('cypress/') && !structure.includes('__tests__/')) {
            recs.push('Add a testing framework (Jest, Cypress, …).');
        }
    }
    if (projType === 'Node.js API') {
        if (!structure.includes('Dockerfile')) {
            recs.push('Consider containerising with Docker.');
        }
    }
    if (projType === 'Python') {
        if (!structure.includes('requirements.txt') && !structure.includes('pyproject.toml'))
            {recs.push('Add a dependency file (requirements.txt or pyproject.toml).');}
        if (!structure.includes('tests/')) {
            recs.push('Add unit tests under a tests/ folder.');
        }
    }

    const fileCount = (structure.match(/📄/g) || []).length;
    if (fileCount > 100) {
        recs.push('Large project – consider further sub‑folder organization.');
    }

    return recs.length ? recs : ['Project structure looks good! 👍'];
}

function detectTechnologies(structure: string): string[] {
    const techMap: Record<string, string[]> = {
        'JavaScript/TypeScript': ['.js', '.ts', '.jsx', '.tsx'],
        Python: ['.py', 'requirements.txt', '__pycache__'],
        Java: ['.java', '.jar', 'pom.xml'],
        'C/C++': ['.c', '.cpp', '.h', '.hpp'],
        Go: ['.go', 'go.mod'],
        Rust: ['.rs', 'Cargo.toml'],
        PHP: ['.php', 'composer.json'],
        Ruby: ['.rb', 'Gemfile'],
        Docker: ['Dockerfile', 'docker-compose'],
        Kubernetes: ['.yaml', '.yml', 'k8s/'],
        Git: ['.git/', '.gitignore'],
        NodeJS: ['package.json', 'node_modules/'],
        Webpack: ['webpack.config'],
        Babel: ['.babelrc', 'babel.config'],
        ESLint: ['.eslintrc'],
        Prettier: ['.prettierrc'],
        Testing: ['jest.config', 'cypress/', '__tests__/', 'test/']
    };
    const found: string[] = [];
    for (const [tech, patterns] of Object.entries(techMap)) {
        if (patterns.some(p => structure.includes(p))) {
            found.push(tech);
        }
    }
    return found;
}

/* --------------------------------------------------------------
   END OF FILE
   -------------------------------------------------------------- */
