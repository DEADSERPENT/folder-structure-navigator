/* ==================================================================
   STRUCTURE GENERATOR (CORE LOGIC - NO VSCODE DEPENDENCIES)
   Pure filesystem logic that can run in Worker threads
   ================================================================== */

import * as fs from 'fs';
import * as path from 'path';
import { FileEntry } from '../models/file-entry.interface';
import { StructureConfig } from '../models/config.interface';
import { getGitignoreRules, getStats, permissionsString, matchesPattern } from '../utils/fs-helpers';
import { formatTree, formatJSON, formatMarkdown, formatXML, formatCSV } from '../utils/formatting';

/* ==================================================================
   PROGRESS AND CANCELLATION CALLBACKS (replaces vscode types)
   ================================================================== */

export type ProgressCallback = (increment: number, message: string) => void;
export type CancellationCheck = () => boolean;

/* ==================================================================
   STRUCTURE GENERATOR CLASS
   ================================================================== */

export class StructureGenerator {
    private readonly cfg: Required<StructureConfig>;
    private readonly onProgress?: ProgressCallback;
    private readonly isCancelled?: CancellationCheck;

    private processed = 0;

    constructor(
        cfg: StructureConfig,
        onProgress?: ProgressCallback,
        isCancelled?: CancellationCheck
    ) {
        // Fill every optional flag with a concrete default
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
            useStreaming: cfg.useStreaming ?? false,
            iconStyle: cfg.iconStyle ?? 'emoji',
            customIcons: cfg.customIcons ?? {},
            compressLargeDirs: cfg.compressLargeDirs ?? true,
            compressionThreshold: cfg.compressionThreshold ?? 50,
            autoSave: cfg.autoSave ?? true,
            autoOpen: cfg.autoOpen ?? true
        };

        this.onProgress = onProgress;
        this.isCancelled = isCancelled;
    }

    /** Public entry – returns **already formatted** text (tree / json / …) */
    async generate(rootPath: string): Promise<string> {
        // Build the in-memory tree (OPTIMIZATION: removed countItems double-scan)
        const start = Date.now();
        const root = await this.buildTree(rootPath, 0);
        const generationTime = Date.now() - start;

        // Format the result according to the selected outputFormat
        return this.formatOutput(root, generationTime);
    }

    /* -----------------------------------------------------------------
       BUILD THE TREE (recursive)
       ----------------------------------------------------------------- */
    private async buildTree(dir: string, depth: number): Promise<FileEntry> {
        // cancellation check
        if (this.isCancelled && this.isCancelled()) {
            throw new Error('Operation cancelled');
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
            const stats = await getStats(dir);
            if (stats) {
                entry.size = stats.size;
                if (this.cfg.includePermissions) {
                    entry.permissions = permissionsString(stats.mode);
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
            if (this.onProgress) {
                this.onProgress(1, `Processing ${item.name}`);
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

            // per-item metadata (if requested)
            if (this.cfg.includeSize || this.cfg.includePermissions || this.cfg.includeModifiedDate) {
                const stats = await getStats(itemPath);
                if (stats) {
                    child.size = stats.size;
                    if (this.cfg.includePermissions) {
                        child.permissions = permissionsString(stats.mode);
                    }
                    if (this.cfg.includeModifiedDate) {
                        child.modified = stats.mtime;
                    }
                }
            }

            // recursion for sub-folders
            if (item.isDirectory()) {
                child.children = (await this.buildTree(itemPath, depth + 1)).children;
            }

            entry.children!.push(child);
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

        // ---- glob-pattern exclusions ---------------------------------------
        if (this.cfg.excludePatterns) {
            out = out.filter(i => {
                const full = path.join(parentPath, i.name);
                return !this.cfg.excludePatterns!.some(p => matchesPattern(full, p));
            });
        }

        // ---- .gitignore handling -------------------------------------------
        if (this.cfg.respectGitignore) {
            const rules = await getGitignoreRules(parentPath);
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
       SORTING (size / modified / type)
       ----------------------------------------------------------------- */
    private sortEntries(entries: FileEntry[]) {
        entries.sort((a, b) => {
            // directories always first (unless sortBy = 'type')
            if (a.type === 'directory' && b.type !== 'directory') { return -1; }
            if (a.type !== 'directory' && b.type === 'directory') { return 1; }

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
                return formatJSON(root, this.cfg, genTime, this.processed);
            case 'markdown':
                return formatMarkdown(root, this.cfg, genTime, this.processed);
            case 'xml':
                return formatXML(root, genTime);
            case 'csv':
                return formatCSV(root);
            default:
                return formatTree(root, this.cfg, '', genTime);
        }
    }
}
