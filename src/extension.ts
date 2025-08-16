import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Worker } from 'worker_threads';

// ================================================================= //
//                            TYPE DEFINITIONS                       //
// ================================================================= //

interface StructureConfig {
    includeHidden?: boolean;
    extensionFilter?: string[] | null;
    excludeFolders?: string[] | null;
    excludePatterns?: string[] | null;
    maxDepth?: number;
    respectGitignore?: boolean;
    includeSize?: boolean;
    includePermissions?: boolean;
    sortBy?: 'name' | 'size' | 'modified' | 'type';
    outputFormat?: 'tree' | 'json' | 'markdown' | 'xml';
    useWorker?: boolean;
}

interface FileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'symlink';
    size?: number;
    modified?: Date;
    permissions?: string;
    children?: FileEntry[];
}

interface GitignoreRules {
    patterns: string[];
    isIgnored: (filePath: string) => boolean;
}

interface StructurePlugin {
    name: string;
    version: string;
    processEntry?(entry: FileEntry): FileEntry;
    formatOutput?(structure: string, format: string): string;
    addCommands?(context: vscode.ExtensionContext): void;
}


// ================================================================= //
//                      GLOBAL CACHES & SINGLETONS                   //
// ================================================================= //

const gitignoreCache = new Map<string, GitignoreRules>();
const statsCache = new Map<string, fs.Stats>();


// ================================================================= //
//                         EXTENSION LIFECYCLE                       //
// ================================================================= //

export function activate(context: vscode.ExtensionContext) {
    console.log('Advanced Folder Structure Navigator v2.0 is now active!');

    // --- Main Commands ---
    const generateStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateStructure',
        async (uri: vscode.Uri) => {
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: 'Generating folder structure...',
                cancellable: true
            };

            await vscode.window.withProgress(progressOptions, async (progress, token) => {
                try {
                    if (!uri || !await isValidDirectory(uri.fsPath)) {
                        throw new Error('Please select a valid directory.');
                    }

                    const config = await getConfigFromSettings();
                    const generator = new StructureGenerator(config, progress, token);

                    progress.report({ message: 'Analyzing directory...' });
                    const structure = await generator.generate(uri.fsPath);

                    progress.report({ message: 'Saving results...' });
                    await saveAndPresentResults(uri.fsPath, structure, config);

                } catch (error) {
                    if (error instanceof vscode.CancellationError) {
                        vscode.window.showInformationMessage('Structure generation cancelled.');
                    } else {
                        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            });
        }
    );

    const generateInteractiveStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateInteractiveStructure',
        async (uri: vscode.Uri) => {
            if (!uri || !await isValidDirectory(uri.fsPath)) {
                vscode.window.showErrorMessage('Please select a valid directory.');
                return;
            }

            const config = await showAdvancedConfigurationWizard();
            if (!config) {return;}

            const progressOptions = {
                location: vscode.ProgressLocation.Window,
                title: 'Generating interactive structure...'
            };

            await vscode.window.withProgress(progressOptions, async (progress) => {
                const generator = new StructureGenerator(config, progress);
                const structure = await generator.generate(uri.fsPath);
                await saveAndPresentResults(uri.fsPath, structure, config);
            });
        }
    );

    const compareDirectories = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.compareDirectories',
        async () => {
            const options = {
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: true,
                openLabel: 'Select directories to compare'
            };

            const uris = await vscode.window.showOpenDialog(options);
            if (!uris || uris.length !== 2) {
                vscode.window.showErrorMessage('Please select exactly two directories to compare.');
                return;
            }

            await compareDirectoryStructures(uris[0].fsPath, uris[1].fsPath);
        }
    );

    const exportStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.exportStructure',
        async (uri: vscode.Uri) => {
            if (!uri || !await isValidDirectory(uri.fsPath)) {
                vscode.window.showErrorMessage('Please select a valid directory.');
                return;
            }

            const format = await vscode.window.showQuickPick(
                ['Tree View', 'JSON', 'Markdown', 'XML', 'CSV'],
                { placeHolder: 'Select export format' }
            );

            if (!format) {return;}

            const config: StructureConfig = {
                outputFormat: format.toLowerCase().replace(' view', '') as any,
                includeSize: true,
                includePermissions: false
            };

            const generator = new StructureGenerator(config);
            const structure = await generator.generate(uri.fsPath);
            await saveStructureToFile(uri.fsPath, structure, config);
        }
    );

    // --- Additional Commands ---
    const showPerformanceReport = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.showPerformanceReport',
        async () => {
            const monitor = PerformanceMonitor.getInstance();
            const cache = AdvancedCache.getInstance();

            const report = `# Performance Report
    
${monitor.getMetricsReport()}
    
## Cache Statistics
- **Cache Size:** ${cache.getCacheStats().size} entries
- **Hit Rate:** ${cache.getCacheStats().hitRate.toFixed(2)}%
    
## Memory Usage
- **Heap Used:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
- **Heap Total:** ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB
- **RSS:** ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB
    
Generated: ${new Date().toISOString()}`;

            const uri = vscode.Uri.parse('untitled:performance-report.md');
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);

            await editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(0, 0), report);
            });
        }
    );

    const manageTemplates = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.manageTemplates',
        async () => {
            const action = await vscode.window.showQuickPick([
                { label: '📋 List Templates', value: 'list' },
                { label: '💾 Save Current Config as Template', value: 'save' },
                { label: '📂 Load Template', value: 'load' },
                { label: '🗑️ Delete Template', value: 'delete' }
            ], { placeHolder: 'Select template action' });

            if (!action) {return;}

            switch (action.value) {
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
    );

    const batchProcess = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.batchProcess',
        async () => {
            const options = {
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: true,
                openLabel: 'Select directories for batch processing'
            };

            const uris = await vscode.window.showOpenDialog(options);
            if (!uris || uris.length === 0) {
                return;
            }

            const config = await showAdvancedConfigurationWizard();
            if (!config) {return;}

            const progressOptions = {
                location: vscode.ProgressLocation.Window,
                title: 'Batch Processing Directories...',
                cancellable: true
            };

            await vscode.window.withProgress(progressOptions, async (progress, token) => {
                const results: string[] = [];

                for (let i = 0; i < uris.length; i++) {
                    if (token.isCancellationRequested) {break;}

                    const uri = uris[i];
                    const dirName = path.basename(uri.fsPath);

                    progress.report({
                        message: `Processing ${dirName} (${i + 1}/${uris.length})...`,
                        increment: (100 / uris.length)
                    });

                    try {
                        const generator = new StructureGenerator(config);
                        const structure = await generator.generate(uri.fsPath);
                        results.push(`## 📁 ${dirName}\n\n\`\`\`\n${structure}\`\`\`\n\n`);
                    } catch (error) {
                        results.push(`## ❌ ${dirName}\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`);
                    }
                }

                if (results.length > 0) {
                    const batchReport = `# Batch Processing Report\n\n**Generated:** ${new Date().toISOString()}\n**Directories Processed:** ${results.length}\n\n${results.join('')}`;

                    const reportUri = vscode.Uri.parse('untitled:batch-report.md');
                    const doc = await vscode.workspace.openTextDocument(reportUri);
                    const editor = await vscode.window.showTextDocument(doc);

                    await editor.edit(editBuilder => {
                        editBuilder.insert(new vscode.Position(0, 0), batchReport);
                    });
                }
            });
        }
    );
    
    const generateWithAnalysis = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateWithAnalysis',
        async (uri: vscode.Uri) => {
            if (!uri || !await isValidDirectory(uri.fsPath)) {
                vscode.window.showErrorMessage('Please select a valid directory.');
                return;
            }
    
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: 'Generating structure with AI analysis...',
                cancellable: true
            };
    
            await vscode.window.withProgress(progressOptions, async (progress, token) => {
                try {
                    progress.report({ message: 'Analyzing project structure...' });
    
                    const config: StructureConfig = {
                        includeSize: true,
                        maxDepth: 8,
                        respectGitignore: true,
                        outputFormat: 'markdown'
                    };
    
                    const generator = new StructureGenerator(config, progress, token);
                    const structure = await generator.generate(uri.fsPath);
    
                    progress.report({ message: 'Analyzing patterns and generating insights...' });
    
                    const analysis = analyzeProjectStructure(uri.fsPath, structure);
    
                    const report = `# Project Structure Analysis
    
${structure}
    
${analysis}`;
    
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const fileName = `structure-analysis_${timestamp}.md`;
                    const filePath = path.join(uri.fsPath, fileName);
    
                    await fs.promises.writeFile(filePath, report, 'utf8');
    
                    const doc = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(doc);
    
                } catch (error) {
                    if (error instanceof vscode.CancellationError) {
                        vscode.window.showInformationMessage('Analysis cancelled.');
                    } else {
                        vscode.window.showErrorMessage(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            });
        }
    );

    // --- Preset Commands ---
    const applyMinimalPreset = vscode.commands.registerCommand('advanced-folder-structure-navigator.applyMinimalPreset', () => applyPreset('minimal'));
    const applyDetailedPreset = vscode.commands.registerCommand('advanced-folder-structure-navigator.applyDetailedPreset', () => applyPreset('detailed'));
    const applyDocumentationPreset = vscode.commands.registerCommand('advanced-folder-structure-navigator.applyDocumentationPreset', () => applyPreset('documentation'));
    const applyDevelopmentPreset = vscode.commands.registerCommand('advanced-folder-structure-navigator.applyDevelopmentPreset', () => applyPreset('development'));


    // --- Register All Commands ---
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

export function deactivate() {
    // Clear caches
    const cache = AdvancedCache.getInstance();
    cache.clear();

    gitignoreCache.clear();
    statsCache.clear();

    // Log performance metrics
    const monitor = PerformanceMonitor.getInstance();
    console.log('Final Performance Report:', monitor.getMetricsReport());

    console.log('Advanced Folder Structure Navigator v2.0 deactivated');
}


// ================================================================= //
//                         CORE FUNCTIONALITY                        //
// ================================================================= //

class StructureGenerator {
    private config: StructureConfig;
    private progress?: vscode.Progress<{ message?: string; increment?: number }>;
    private token?: vscode.CancellationToken;
    private processedCount = 0;
    private totalCount = 0;

    constructor(
        config: StructureConfig,
        progress?: vscode.Progress<{ message?: string; increment?: number }>,
        token?: vscode.CancellationToken
    ) {
        this.config = config;
        this.progress = progress;
        this.token = token;
    }

    async generate(rootPath: string): Promise<string> {
        // First pass: count total items for progress tracking
        if (this.progress) {
            this.totalCount = await this.countItems(rootPath);
        }

        const startTime = Date.now();
        const rootEntry = await this.buildFileTree(rootPath, 0);
        const generationTime = Date.now() - startTime;
        
        PerformanceMonitor.getInstance().recordOperation('generateStructure', generationTime);

        return this.formatOutput(rootEntry, generationTime);
    }

    private async countItems(dirPath: string, depth: number = 0): Promise<number> {
        if (this.config.maxDepth && depth >= this.config.maxDepth) {return 0;}
        if (this.token?.isCancellationRequested) {return 0;}

        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            let count = entries.length;

            for (const entry of entries) {
                if (entry.isDirectory() && this.shouldIncludeEntry(entry, dirPath)) {
                    count += await this.countItems(path.join(dirPath, entry.name), depth + 1);
                }
            }

            return count;
        } catch {
            return 0;
        }
    }

    private async buildFileTree(dirPath: string, depth: number = 0): Promise<FileEntry> {
        if (this.token?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        if (this.config.maxDepth && depth >= this.config.maxDepth) {
            return {
                name: path.basename(dirPath),
                path: dirPath,
                type: 'directory',
                children: []
            };
        }

        const entry: FileEntry = {
            name: path.basename(dirPath) || dirPath,
            path: dirPath,
            type: 'directory',
            children: []
        };

        try {
            // Get directory stats if needed
            if (this.config.includeSize || this.config.includePermissions) {
                const stats = await this.getFileStats(dirPath);
                if (stats) {
                    entry.size = stats.size;
                    entry.modified = stats.mtime;
                    if (this.config.includePermissions) {
                        entry.permissions = this.getPermissionsString(stats.mode);
                    }
                }
            }

            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const filteredItems = await this.filterAndSortEntries(items, dirPath);

            for (const item of filteredItems) {
                this.processedCount++;
                if (this.progress && this.totalCount > 0) {
                    const percentage = Math.round((this.processedCount / this.totalCount) * 100);
                    this.progress.report({
                        message: `Processing ${item.name} (${percentage}%)`,
                        increment: 1
                    });
                }

                const itemPath = path.join(dirPath, item.name);
                const childEntry = await this.createEntry(item, itemPath, depth);

                if (childEntry) {
                    entry.children!.push(childEntry);
                }
            }

            // Sort children if specified
            if (this.config.sortBy && entry.children) {
                this.sortEntries(entry.children);
            }

        } catch (error) {
            console.error(`Error processing ${dirPath}:`, error);
        }

        return entry;
    }

    private async createEntry(item: fs.Dirent, itemPath: string, depth: number): Promise<FileEntry | null> {
        if (!this.shouldIncludeEntry(item, path.dirname(itemPath))) {
            return null;
        }

        const entry: FileEntry = {
            name: item.name,
            path: itemPath,
            type: item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file'
        };

        // Get file/directory stats
        if (this.config.includeSize || this.config.includePermissions) {
            const stats = await this.getFileStats(itemPath);
            if (stats) {
                entry.size = stats.size;
                entry.modified = stats.mtime;
                if (this.config.includePermissions) {
                    entry.permissions = this.getPermissionsString(stats.mode);
                }
            }
        }

        // Recursively process directories
        if (item.isDirectory()) {
            const subTree = await this.buildFileTree(itemPath, depth + 1);
            entry.children = subTree.children;
        }

        return entry;
    }

    private async filterAndSortEntries(items: fs.Dirent[], dirPath: string): Promise<fs.Dirent[]> {
        let filtered = items.filter(item => this.shouldIncludeEntry(item, dirPath));

        // Apply gitignore rules if enabled
        if (this.config.respectGitignore) {
            const gitignoreRules = await this.getGitignoreRules(dirPath);
            if (gitignoreRules) {
                filtered = filtered.filter(item => {
                    const itemPath = path.join(dirPath, item.name);
                    return !gitignoreRules.isIgnored(itemPath);
                });
            }
        }

        return filtered;
    }

    private shouldIncludeEntry(item: fs.Dirent, parentPath: string): boolean {
        // Hidden files check
        if (!this.config.includeHidden && item.name.startsWith('.')) {
            return false;
        }

        // Excluded folders check
        if (this.config.excludeFolders && item.isDirectory() &&
            this.config.excludeFolders.includes(item.name)) {
            return false;
        }

        // Extension filter for files
        if (this.config.extensionFilter && item.isFile()) {
            const ext = path.extname(item.name).slice(1).toLowerCase();
            return this.config.extensionFilter.includes(ext);
        }

        // Pattern exclusion check
        if (this.config.excludePatterns) {
            const itemPath = path.join(parentPath, item.name);
            for (const pattern of this.config.excludePatterns) {
                if (this.matchesPattern(itemPath, pattern)) {
                    return false;
                }
            }
        }

        return true;
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Simple glob pattern matching
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]');

        return new RegExp(`^${regexPattern}$`).test(filePath);
    }

    private async getFileStats(filePath: string): Promise<fs.Stats | null> {
        if (statsCache.has(filePath)) {
            return statsCache.get(filePath)!;
        }

        try {
            const stats = await fs.promises.stat(filePath);
            statsCache.set(filePath, stats);
            return stats;
        } catch {
            return null;
        }
    }

    private getPermissionsString(mode: number): string {
        const permissions = [];

        // Owner permissions
        permissions.push((mode & 0o400) ? 'r' : '-');
        permissions.push((mode & 0o200) ? 'w' : '-');
        permissions.push((mode & 0o100) ? 'x' : '-');

        // Group permissions
        permissions.push((mode & 0o040) ? 'r' : '-');
        permissions.push((mode & 0o020) ? 'w' : '-');
        permissions.push((mode & 0o010) ? 'x' : '-');

        // Other permissions
        permissions.push((mode & 0o004) ? 'r' : '-');
        permissions.push((mode & 0o002) ? 'w' : '-');
        permissions.push((mode & 0o001) ? 'x' : '-');

        return permissions.join('');
    }

    private async getGitignoreRules(dirPath: string): Promise<GitignoreRules | null> {
        if (gitignoreCache.has(dirPath)) {
            return gitignoreCache.get(dirPath)!;
        }

        const gitignorePath = await this.findNearestGitignore(dirPath);
        if (!gitignorePath) {return null;}

        try {
            const content = await fs.promises.readFile(gitignorePath, 'utf8');
            const patterns = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));

            const rules: GitignoreRules = {
                patterns,
                isIgnored: (filePath: string) => {
                    const relativePath = path.relative(path.dirname(gitignorePath), filePath);
                    return patterns.some(pattern => this.matchesPattern(relativePath, pattern));
                }
            };

            gitignoreCache.set(dirPath, rules);
            return rules;
        } catch {
            return null;
        }
    }

    private async findNearestGitignore(startPath: string): Promise<string | null> {
        let currentPath = startPath;

        while (currentPath !== path.dirname(currentPath)) {
            const candidatePath = path.join(currentPath, '.gitignore');

            try {
                await fs.promises.access(candidatePath);
                return candidatePath;
            } catch {
                // Continue searching
            }

            currentPath = path.dirname(currentPath);
        }

        return null;
    }

    private sortEntries(entries: FileEntry[]): void {
        entries.sort((a, b) => {
            // Always show directories first
            if (a.type === 'directory' && b.type !== 'directory') {return -1;}
            if (a.type !== 'directory' && b.type === 'directory') {return 1;}

            switch (this.config.sortBy) {
                case 'size':
                    return (b.size || 0) - (a.size || 0);
                case 'modified':
                    const aTime = a.modified?.getTime() || 0;
                    const bTime = b.modified?.getTime() || 0;
                    return bTime - aTime;
                case 'type':
                    return a.type.localeCompare(b.type);
                default:
                    return a.name.localeCompare(b.name, undefined, { numeric: true });
            }
        });

        // Recursively sort children
        entries.forEach(entry => {
            if (entry.children) {
                this.sortEntries(entry.children);
            }
        });
    }

    private formatOutput(entry: FileEntry, generationTime: number): string {
        switch (this.config.outputFormat) {
            case 'json':
                return this.formatAsJSON(entry, generationTime);
            case 'markdown':
                return this.formatAsMarkdown(entry, generationTime);
            case 'xml':
                return this.formatAsXML(entry, generationTime);
            default:
                return this.formatAsTree(entry, '', generationTime);
        }
    }

    private formatAsTree(entry: FileEntry, prefix: string = '', generationTime?: number): string {
        let output = '';

        if (!prefix) {
            // Root header with metadata
            output += `📁 ${entry.name}\n`;
            if (generationTime) {
                output += `⏱️  Generated in ${generationTime}ms\n`;
            }
            if (this.processedCount > 0) {
                output += `📊 ${this.processedCount} items processed\n`;
            }
            output += '─'.repeat(50) + '\n';
        }

        if (entry.children && entry.children.length > 0) {
            for (let i = 0; i < entry.children.length; i++) {
                const child = entry.children[i];
                const isLast = i === entry.children.length - 1;
                const pointer = isLast ? '└── ' : '├── ';
                const icon = this.getIcon(child);

                let line = `${prefix}${pointer}${icon}${child.name}`;

                // Add metadata if enabled
                if (this.config.includeSize && child.size !== undefined) {
                    line += ` (${this.formatFileSize(child.size)})`;
                }
                if (this.config.includePermissions && child.permissions) {
                    line += ` [${child.permissions}]`;
                }

                output += line + '\n';

                if (child.children && child.children.length > 0) {
                    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
                    output += this.formatAsTree(child, nextPrefix);
                }
            }
        }

        return output;
    }

    private formatAsJSON(entry: FileEntry, generationTime: number): string {
        const metadata = {
            generatedAt: new Date().toISOString(),
            generationTime: `${generationTime}ms`,
            itemsProcessed: this.processedCount,
            configuration: this.config
        };

        return JSON.stringify({
            metadata,
            structure: entry
        }, null, 2);
    }

    private formatAsMarkdown(entry: FileEntry, generationTime: number): string {
        let output = `# 📁 ${entry.name}\n\n`;
        output += `**Generated:** ${new Date().toISOString()}\n`;
        output += `**Generation Time:** ${generationTime}ms\n`;
        output += `**Items Processed:** ${this.processedCount}\n\n`;

        output += '## Directory Structure\n\n```\n';
        output += this.formatAsTree(entry);
        output += '```\n';

        return output;
    }

    private formatAsXML(entry: FileEntry, generationTime: number): string {
        let output = '<?xml version="1.0" encoding="UTF-8"?>\n';
        output += '<directory-structure>\n';
        output += `  <metadata>\n`;
        output += `    <generated-at>${new Date().toISOString()}</generated-at>\n`;
        output += `    <generation-time>${generationTime}ms</generation-time>\n`;
        output += `    <items-processed>${this.processedCount}</items-processed>\n`;
        output += `  </metadata>\n`;
        output += this.formatEntryAsXML(entry, 2);
        output += '</directory-structure>\n';

        return output;
    }

    private formatEntryAsXML(entry: FileEntry, indent: number): string {
        const spaces = '  '.repeat(indent);
        let output = `${spaces}<${entry.type} name="${entry.name}"`;

        if (entry.size !== undefined) {
            output += ` size="${entry.size}"`;
        }
        if (entry.permissions) {
            output += ` permissions="${entry.permissions}"`;
        }

        if (entry.children && entry.children.length > 0) {
            output += '>\n';
            for (const child of entry.children) {
                output += this.formatEntryAsXML(child, indent + 1);
            }
            output += `${spaces}</${entry.type}>\n`;
        } else {
            output += '/>\n';
        }

        return output;
    }

    private getIcon(entry: FileEntry): string {
        if (entry.type === 'directory') {return '📁 ';}
        if (entry.type === 'symlink') {return '🔗 ';}

        const ext = path.extname(entry.name).toLowerCase();
        const iconMap: Record<string, string> = {
            '.js': '🟨 ',
            '.ts': '🔷 ',
            '.json': '📋 ',
            '.md': '📝 ',
            '.txt': '📄 ',
            '.yml': '⚙️ ',
            '.yaml': '⚙️ ',
            '.xml': '📋 ',
            '.html': '🌐 ',
            '.css': '🎨 ',
            '.py': '🐍 ',
            '.java': '☕ ',
            '.cpp': '⚡ ',
            '.c': '⚡ ',
            '.go': '🐹 ',
            '.rs': '🦀 ',
            '.php': '🐘 '
        };

        return iconMap[ext] || '📄 ';
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) {return '0 B';}

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const dm = 2;

        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + units[i];
    }
}


// ================================================================= //
//                       CONFIGURATION & UI HELPERS                  //
// ================================================================= //

async function getConfigFromSettings(): Promise<StructureConfig> {
    const config = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');

    return {
        includeHidden: config.get<boolean>('includeHiddenFiles') || false,
        extensionFilter: config.get<string[]>('extensionFilter') || null,
        excludeFolders: config.get<string[]>('excludeFolders') || [
            'node_modules', '.git', 'dist', 'build', '.vscode'
        ],
        excludePatterns: config.get<string[]>('excludePatterns') || null,
        maxDepth: config.get<number>('maxDepth') || 10,
        respectGitignore: config.get<boolean>('respectGitignore') || true,
        includeSize: config.get<boolean>('includeSize') || false,
        includePermissions: config.get<boolean>('includePermissions') || false,
        sortBy: config.get<'name' | 'size' | 'modified' | 'type'>('sortBy') || 'name',
        outputFormat: config.get<'tree' | 'json' | 'markdown' | 'xml'>('outputFormat') || 'tree'
    };
}

async function showAdvancedConfigurationWizard(): Promise<StructureConfig | null> {
    const config: StructureConfig = {};

    // Step 1: Basic options
    const basicOptions = await vscode.window.showQuickPick([
        { label: '📁 Include hidden files', description: 'Show .dotfiles and hidden directories', value: 'includeHidden' },
        { label: '📏 Include file sizes', description: 'Show file and directory sizes', value: 'includeSize' },
        { label: '🔒 Include permissions', description: 'Show file permissions (Unix-like systems)', value: 'includePermissions' },
        { label: '🚫 Respect .gitignore', description: 'Skip files ignored by Git', value: 'respectGitignore' }
    ], {
        placeHolder: 'Select basic options',
        canPickMany: true
    });

    if (basicOptions) {
        config.includeHidden = basicOptions.some(opt => opt.value === 'includeHidden');
        config.includeSize = basicOptions.some(opt => opt.value === 'includeSize');
        config.includePermissions = basicOptions.some(opt => opt.value === 'includePermissions');
        config.respectGitignore = basicOptions.some(opt => opt.value === 'respectGitignore');
    }

    // Step 2: Filtering options
    const filterType = await vscode.window.showQuickPick([
        { label: '🌟 Standard filtering', value: 'standard' },
        { label: '🎯 Custom extensions only', value: 'extensions' },
        { label: '🚫 Exclude specific patterns', value: 'exclude' }
    ], { placeHolder: 'Choose filtering approach' });

    if (filterType?.value === 'extensions') {
        const extensions = await vscode.window.showInputBox({
            prompt: 'Enter file extensions (comma-separated, e.g., js,ts,json):',
            validateInput: (value) => {
                if (value && !value.match(/^[a-zA-Z0-9,\s]+$/)) {
                    return 'Invalid format. Use comma-separated extensions without dots.';
                }
                return null;
            }
        });
        if (extensions) {
            config.extensionFilter = extensions.split(',').map(ext => ext.trim().toLowerCase());
        }
    } else if (filterType?.value === 'exclude') {
        const patterns = await vscode.window.showInputBox({
            prompt: 'Enter exclude patterns (comma-separated, e.g., *.log,temp/**,test/*):',
            placeHolder: 'Use * for wildcards, ** for recursive matching'
        });
        if (patterns) {
            config.excludePatterns = patterns.split(',').map(pattern => pattern.trim());
        }
    }

    // Step 3: Output format
    const format = await vscode.window.showQuickPick([
        { label: '🌳 Tree view', value: 'tree' },
        { label: '📋 JSON format', value: 'json' },
        { label: '📝 Markdown document', value: 'markdown' },
        { label: '🏷️ XML format', value: 'xml' }
    ], { placeHolder: 'Select output format' });

    if (format) {
        config.outputFormat = format.value as any;
    }

    // Step 4: Advanced options
    const maxDepthStr = await vscode.window.showInputBox({
        prompt: 'Maximum depth to traverse (default: 10, 0 = unlimited):',
        value: '10',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 0) {
                return 'Please enter a valid number (0 or greater)';
            }
            return null;
        }
    });

    if (maxDepthStr) {
        const depth = parseInt(maxDepthStr);
        config.maxDepth = depth === 0 ? undefined : depth;
    }

    return config;
}


// ================================================================= //
//                            HELPER FUNCTIONS                       //
// ================================================================= //

async function isValidDirectory(dirPath: string): Promise<boolean> {
    try {
        const stats = await fs.promises.stat(dirPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

async function saveAndPresentResults(
    rootPath: string,
    structure: string,
    config: StructureConfig
): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const formatExt = config.outputFormat === 'tree' ? 'txt' : config.outputFormat || 'txt';
    const fileName = `structure_${timestamp}.${formatExt}`;
    const filePath = path.join(rootPath, fileName);

    await fs.promises.writeFile(filePath, structure, 'utf8');

    const action = await vscode.window.showInformationMessage(
        `Structure saved to ${fileName}`,
        'Open File',
        'Copy to Clipboard',
        'Open in New Window'
    );

    switch (action) {
        case 'Open File':
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
            break;
        case 'Copy to Clipboard':
            await vscode.env.clipboard.writeText(structure);
            vscode.window.showInformationMessage('Structure copied to clipboard!');
            break;
        case 'Open in New Window':
            await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(filePath));
            break;
    }
}

async function saveStructureToFile(
    rootPath: string,
    structure: string,
    config: StructureConfig
): Promise<void> {
    const formatExt = config.outputFormat === 'tree' ? 'txt' : config.outputFormat || 'txt';
    const fileName = `exported_structure.${formatExt}`;
    const filePath = path.join(rootPath, fileName);

    await fs.promises.writeFile(filePath, structure, 'utf8');
    vscode.window.showInformationMessage(`Structure exported to ${fileName}`);
}

async function compareDirectoryStructures(path1: string, path2: string): Promise<void> {
    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: 'Comparing directory structures...',
        cancellable: true
    };

    await vscode.window.withProgress(progressOptions, async (progress, token) => {
        try {
            progress.report({ message: 'Analyzing first directory...' });
            const config: StructureConfig = { includeSize: true, sortBy: 'name' };

            const generator1 = new StructureGenerator(config);
            const structure1 = await generator1.generate(path1);

            progress.report({ message: 'Analyzing second directory...' });
            const generator2 = new StructureGenerator(config);
            const structure2 = await generator2.generate(path2);

            progress.report({ message: 'Generating comparison report...' });
            const comparison = generateComparisonReport(path1, path2, structure1, structure2);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `comparison_${timestamp}.md`;
            const outputPath = path.join(path.dirname(path1), fileName);

            await fs.promises.writeFile(outputPath, comparison, 'utf8');

            const doc = await vscode.workspace.openTextDocument(outputPath);
            await vscode.window.showTextDocument(doc);

        } catch (error) {
            if (error instanceof vscode.CancellationError) {
                vscode.window.showInformationMessage('Comparison cancelled.');
            } else {
                vscode.window.showErrorMessage(`Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });
}

function generateComparisonReport(path1: string, path2: string, structure1: string, structure2: string): string {
    const dir1Name = path.basename(path1);
    const dir2Name = path.basename(path2);

    let report = `# Directory Comparison Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Directory 1:** \`${path1}\`\n`;
    report += `**Directory 2:** \`${path2}\`\n\n`;

    report += `## 📁 ${dir1Name}\n\n`;
    report += `\`\`\`\n${structure1}\`\`\`\n\n`;

    report += `## 📁 ${dir2Name}\n\n`;
    report += `\`\`\`\n${structure2}\`\`\`\n\n`;

    report += `## 🔍 Analysis\n\n`;
    report += `- **${dir1Name}** structure shown above\n`;
    report += `- **${dir2Name}** structure shown above\n`;
    report += `- Use diff tools or manual comparison to identify differences\n`;

    return report;
}


// ================================================================= //
//                         TEMPLATE MANAGEMENT                       //
// ================================================================= //

async function listTemplates(): Promise<void> {
    const workspaceTemplates = await WorkspaceIntegration.loadWorkspaceTemplates();
    const globalTemplates = TemplateEngine.listTemplates();

    let templateList = '# Available Templates\n\n';

    if (Object.keys(workspaceTemplates).length > 0) {
        templateList += '## Workspace Templates\n\n';
        for (const [name, config] of Object.entries(workspaceTemplates)) {
            templateList += `### ${name}\n`;
            templateList += `- **Output Format:** ${config.outputFormat || 'tree'}\n`;
            templateList += `- **Max Depth:** ${config.maxDepth || 'unlimited'}\n`;
            templateList += `- **Include Hidden:** ${config.includeHidden || false}\n`;
            templateList += `- **Include Size:** ${config.includeSize || false}\n\n`;
        }
    }

    if (globalTemplates.length > 0) {
        templateList += '## Global Templates\n\n';
        globalTemplates.forEach(name => {
            templateList += `- ${name}\n`;
        });
    }

    const uri = vscode.Uri.parse('untitled:templates.md');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(0, 0), templateList);
    });
}

async function saveCurrentConfigAsTemplate(): Promise<void> {
    const templateName = await vscode.window.showInputBox({
        prompt: 'Enter template name:',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Template name cannot be empty';
            }
            if (value.length > 50) {
                return 'Template name too long (max 50 characters)';
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                return 'Template name can only contain letters, numbers, underscores, and hyphens';
            }
            return null;
        }
    });

    if (!templateName) {return;}

    const config = await getConfigFromSettings();
    await WorkspaceIntegration.saveWorkspaceTemplate(templateName.trim(), config);
}

async function loadTemplate(): Promise<void> {
    const workspaceTemplates = await WorkspaceIntegration.loadWorkspaceTemplates();
    const templateNames = Object.keys(workspaceTemplates);

    if (templateNames.length === 0) {
        vscode.window.showInformationMessage('No templates found. Create one first!');
        return;
    }

    const selectedTemplate = await vscode.window.showQuickPick(
        templateNames.map(name => ({
            label: name,
            description: `Format: ${workspaceTemplates[name].outputFormat || 'tree'}`
        })),
        { placeHolder: 'Select template to load' }
    );

    if (!selectedTemplate) {return;}

    const config = workspaceTemplates[selectedTemplate.label];

    // Apply template config to VS Code settings
    const workspaceConfig = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');

    for (const [key, value] of Object.entries(config)) {
        await workspaceConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    vscode.window.showInformationMessage(`Template '${selectedTemplate.label}' loaded successfully!`);
}

async function deleteTemplate(): Promise<void> {
    const workspaceTemplates = await WorkspaceIntegration.loadWorkspaceTemplates();
    const templateNames = Object.keys(workspaceTemplates);

    if (templateNames.length === 0) {
        vscode.window.showInformationMessage('No templates found to delete.');
        return;
    }

    const selectedTemplate = await vscode.window.showQuickPick(
        templateNames,
        { placeHolder: 'Select template to delete' }
    );

    if (!selectedTemplate) {return;}

    const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete template '${selectedTemplate}'?`,
        { modal: true },
        'Delete'
    );

    if (confirmation === 'Delete') {
        delete workspaceTemplates[selectedTemplate];

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const templatesPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'folder-navigator-templates.json');
            await fs.promises.writeFile(templatesPath, JSON.stringify(workspaceTemplates, null, 2), 'utf8');
            vscode.window.showInformationMessage(`Template '${selectedTemplate}' deleted successfully!`);
        }
    }
}

async function applyPreset(presetName: string): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');
    const presets = workspaceConfig.get('presets') as Record<string, StructureConfig>;

    const preset = presets[presetName];
    if (!preset) {
        vscode.window.showErrorMessage(`Preset '${presetName}' not found!`);
        return;
    }

    // Apply preset configuration
    for (const [key, value] of Object.entries(preset)) {
        await workspaceConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    vscode.window.showInformationMessage(`Applied preset: ${presetName}`);
}


// ================================================================= //
//                      "AI" ANALYSIS FUNCTIONS                      //
// ================================================================= //

function analyzeProjectStructure(rootPath: string, structure: string): string {
    const projectName = path.basename(rootPath);
    const lines = structure.split('\n').filter(line => line.trim());

    // Basic metrics
    const fileCount = lines.filter(line => line.includes('📄')).length;
    const dirCount = lines.filter(line => line.includes('📁')).length;
    const maxDepth = Math.max(...lines.map(line => {
        const match = line.match(/^(\s*)/);
        return match ? Math.floor(match[1].length / 4) : 0;
    }));

    // Detect project type
    const projectType = detectProjectType(structure);

    // Find potential issues
    const issues = findStructureIssues(structure);

    // Generate recommendations
    const recommendations = generateRecommendations(structure, projectType);

    let analysis = `## 📊 Project Analysis

### Basic Metrics
- **Project Name:** ${projectName}
- **Total Files:** ${fileCount}
- **Total Directories:** ${dirCount}
- **Maximum Depth:** ${maxDepth} levels
- **Detected Type:** ${projectType}

### Structure Health
${issues.length > 0 ? `⚠️ **Issues Found:** ${issues.length}` : '✅ **No Issues Detected**'}

${issues.length > 0 ? issues.map(issue => `- ${issue}`).join('\n') : ''}

### Recommendations
${recommendations.map(rec => `- ${rec}`).join('\n')}

### Technology Stack Detection
${detectTechnologies(structure).map(tech => `- ${tech}`).join('\n') || '- No specific technologies detected'}

---
*Analysis generated by Advanced Folder Structure Navigator v2.0*`;

    return analysis;
}

function detectProjectType(structure: string): string {
    const indicators = {
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

    for (const [type, patterns] of Object.entries(indicators)) {
        const matches = patterns.filter(pattern => structure.includes(pattern)).length;
        if (matches >= Math.ceil(patterns.length * 0.4)) {
            return type;
        }
    }

    return 'Unknown/Mixed';
}

function findStructureIssues(structure: string): string[] {
    const issues: string[] = [];

    // Check for very deep nesting
    const lines = structure.split('\n');
    const deepLines = lines.filter(line => {
        const match = line.match(/^(\s*)/);
        const depth = match ? Math.floor(match[1].length / 4) : 0;
        return depth > 8;
    });

    if (deepLines.length > 0) {
        issues.push(`Very deep nesting detected (${deepLines.length} items beyond 8 levels)`);
    }

    // Check for missing common files
    const commonFiles = ['README', 'LICENSE', '.gitignore'];
    const missingFiles = commonFiles.filter(file => !structure.toLowerCase().includes(file.toLowerCase()));

    if (missingFiles.length > 0) {
        issues.push(`Missing common files: ${missingFiles.join(', ')}`);
    }

    // Check for potential security issues
    const sensitivePatterns = ['.env', '.key', '.pem', 'password', 'secret'];
    const foundSensitive = sensitivePatterns.filter(pattern =>
        structure.toLowerCase().includes(pattern)
    );

    if (foundSensitive.length > 0) {
        issues.push(`Potentially sensitive files detected: ${foundSensitive.join(', ')}`);
    }

    return issues;
}

function generateRecommendations(structure: string, projectType: string): string[] {
    const recommendations: string[] = [];

    // Generic recommendations
    if (!structure.includes('README')) {
        recommendations.push('Consider adding a README.md file to document your project');
    }

    if (!structure.includes('.gitignore')) {
        recommendations.push('Add a .gitignore file to exclude unnecessary files from version control');
    }

    // Project-type specific recommendations
    switch (projectType) {
        case 'React/Next.js':
            if (!structure.includes('.eslintrc')) {
                recommendations.push('Consider adding ESLint configuration for code quality');
            }
            if (!structure.includes('cypress/') && !structure.includes('__tests__/')) {
                recommendations.push('Consider adding testing setup (Jest, Cypress, or similar)');
            }
            break;

        case 'Node.js API':
            if (!structure.includes('test/') && !structure.includes('__tests__/')) {
                recommendations.push('Consider adding unit tests for your API endpoints');
            }
            if (!structure.includes('Dockerfile')) {
                recommendations.push('Consider containerizing your application with Docker');
            }
            break;

        case 'Python':
            if (!structure.includes('requirements.txt') && !structure.includes('pyproject.toml')) {
                recommendations.push('Add requirements.txt or pyproject.toml for dependency management');
            }
            if (!structure.includes('tests/')) {
                recommendations.push('Consider adding a tests directory for unit tests');
            }
            break;
    }

    // Structure-based recommendations
    const fileCount = (structure.match(/📄/g) || []).length;
    if (fileCount > 100) {
        recommendations.push('Large project detected - consider organizing files into more subdirectories');
    }

    return recommendations.length > 0 ? recommendations : ['Project structure looks good! 👍'];
}

function detectTechnologies(structure: string): string[] {
    const technologies: string[] = [];

    const techIndicators = {
        'JavaScript/TypeScript': ['.js', '.ts', '.jsx', '.tsx'],
        'Python': ['.py', 'requirements.txt', '__pycache__'],
        'Java': ['.java', '.jar', 'pom.xml'],
        'C/C++': ['.c', '.cpp', '.h', '.hpp'],
        'Go': ['.go', 'go.mod'],
        'Rust': ['.rs', 'Cargo.toml'],
        'PHP': ['.php', 'composer.json'],
        'Ruby': ['.rb', 'Gemfile'],
        'Docker': ['Dockerfile', 'docker-compose'],
        'Kubernetes': ['.yaml', '.yml', 'k8s/'],
        'Git': ['.git/', '.gitignore'],
        'Node.js': ['package.json', 'node_modules/'],
        'Webpack': ['webpack.config'],
        'Babel': ['.babelrc', 'babel.config'],
        'ESLint': ['.eslintrc'],
        'Prettier': ['.prettierrc'],
        'Testing': ['jest.config', 'cypress/', '__tests__/', 'test/']
    };

    for (const [tech, indicators] of Object.entries(techIndicators)) {
        if (indicators.some(indicator => structure.includes(indicator))) {
            technologies.push(tech);
        }
    }

    return technologies;
}


// ================================================================= //
//                    UTILITY & EXTENSIBILITY CLASSES                //
// ================================================================= //

class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, number[]> = new Map();

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    recordOperation(operation: string, duration: number): void {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        this.metrics.get(operation)!.push(duration);

        // Keep only last 100 measurements
        const measurements = this.metrics.get(operation)!;
        if (measurements.length > 100) {
            measurements.splice(0, measurements.length - 100);
        }
    }

    getAverageTime(operation: string): number {
        const measurements = this.metrics.get(operation);
        if (!measurements || measurements.length === 0) {return 0;}

        const sum = measurements.reduce((acc, time) => acc + time, 0);
        return sum / measurements.length;
    }

    getMetricsReport(): string {
        let report = '# Performance Metrics\n\n';

        for (const [operation, measurements] of this.metrics.entries()) {
            if (measurements.length === 0) {continue;}

            const avg = this.getAverageTime(operation);
            const min = Math.min(...measurements);
            const max = Math.max(...measurements);

            report += `## ${operation}\n`;
            report += `- **Average:** ${avg.toFixed(2)}ms\n`;
            report += `- **Min:** ${min}ms\n`;
            report += `- **Max:** ${max}ms\n`;
            report += `- **Samples:** ${measurements.length}\n\n`;
        }

        return report;
    }
}

class AdvancedCache {
    private static instance: AdvancedCache;
    private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
    private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

    static getInstance(): AdvancedCache {
        if (!AdvancedCache.instance) {
            AdvancedCache.instance = new AdvancedCache();
        }
        return AdvancedCache.instance;
    }

    set(key: string, data: any, ttl: number = this.defaultTTL): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });

        // Clean up expired entries periodically
        if (this.cache.size % 50 === 0) {
            this.cleanup();
        }
    }

    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) {return null;}

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }

    getCacheStats(): { size: number; hitRate: number } {
        return {
            size: this.cache.size,
            hitRate: 0 // Would need to track hits/misses for accurate calculation
        };
    }
}

class TemplateEngine {
    private static templates: Map<string, string> = new Map([
        ['minimal', `{name}\n├── {children}`],
        ['detailed', `{icon} {name} ({size}) [{permissions}] {modified}\n├── {children}`],
        ['report', `# Project Structure Report\n\n**Project:** {name}\n**Generated:** {timestamp}\n**Total Files:** {fileCount}\n**Total Directories:** {dirCount}\n\n## Structure\n{tree}`]
    ]);

    static registerTemplate(name: string, template: string): void {
        this.templates.set(name, template);
    }

    static getTemplate(name: string): string | null {
        return this.templates.get(name) || null;
    }

    static listTemplates(): string[] {
        return Array.from(this.templates.keys());
    }

    static renderTemplate(templateName: string, data: Record<string, any>): string {
        const template = this.getTemplate(templateName);
        if (!template) {return '';}

        let result = template;
        for (const [key, value] of Object.entries(data)) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
        }

        return result;
    }
}

class PluginManager {
    private static instance: PluginManager;
    private plugins: Map<string, StructurePlugin> = new Map();

    static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    registerPlugin(plugin: StructurePlugin): void {
        this.plugins.set(plugin.name, plugin);
        console.log(`Registered plugin: ${plugin.name} v${plugin.version}`);
    }

    getPlugin(name: string): StructurePlugin | undefined {
        return this.plugins.get(name);
    }

    getAllPlugins(): StructurePlugin[] {
        return Array.from(this.plugins.values());
    }

    processEntry(entry: FileEntry): FileEntry {
        let processedEntry = entry;

        for (const plugin of this.plugins.values()) {
            if (plugin.processEntry) {
                processedEntry = plugin.processEntry(processedEntry);
            }
        }

        return processedEntry;
    }

    formatOutput(structure: string, format: string): string {
        let formattedOutput = structure;

        for (const plugin of this.plugins.values()) {
            if (plugin.formatOutput) {
                formattedOutput = plugin.formatOutput(formattedOutput, format);
            }
        }

        return formattedOutput;
    }
}

class WorkspaceIntegration {
    static async getWorkspaceSettings(): Promise<StructureConfig> {
        const workspaceConfig = vscode.workspace.getConfiguration();
        const folderConfig = workspaceConfig.get('advanced-folder-structure-navigator') as any || {};

        // Merge with project-specific settings from package.json or .vscode/settings.json
        const projectSettings = await this.loadProjectSettings();

        return { ...folderConfig, ...projectSettings };
    }

    private static async loadProjectSettings(): Promise<Partial<StructureConfig>> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return {};
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const settingsPath = path.join(rootPath, '.vscode', 'folder-navigator.json');

        try {
            const settingsContent = await fs.promises.readFile(settingsPath, 'utf8');
            return JSON.parse(settingsContent);
        } catch {
            return {};
        }
    }

    static async saveWorkspaceTemplate(name: string, config: StructureConfig): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const vscodePath = path.join(rootPath, '.vscode');
        const templatesPath = path.join(vscodePath, 'folder-navigator-templates.json');

        // Ensure .vscode directory exists
        try {
            await fs.promises.mkdir(vscodePath, { recursive: true });
        } catch {
            // Directory might already exist
        }

        let templates: Record<string, StructureConfig> = {};

        try {
            const existing = await fs.promises.readFile(templatesPath, 'utf8');
            templates = JSON.parse(existing);
        } catch {
            // File doesn't exist or invalid JSON, start fresh
        }

        templates[name] = config;

        await fs.promises.writeFile(templatesPath, JSON.stringify(templates, null, 2), 'utf8');
        vscode.window.showInformationMessage(`Template '${name}' saved to workspace`);
    }

    static async loadWorkspaceTemplates(): Promise<Record<string, StructureConfig>> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return {};
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const templatesPath = path.join(rootPath, '.vscode', 'folder-navigator-templates.json');

        try {
            const content = await fs.promises.readFile(templatesPath, 'utf8');
            return JSON.parse(content);
        } catch {
            return {};
        }
    }
}