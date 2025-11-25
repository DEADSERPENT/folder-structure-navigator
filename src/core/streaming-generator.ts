/* ==================================================================
   STREAMING STRUCTURE GENERATOR
   Memory-efficient generator using async generators
   Prevents OOM on massive repositories by yielding items incrementally
   ================================================================== */

import * as fs from 'fs';
import * as path from 'path';
import { StructureConfig } from '../models/config.interface';
import { FileEntry } from '../models/file-entry.interface';
import { StreamEvent, StreamProgressCallback } from '../models/stream.interface';
import { getGitignoreRules, getStats, permissionsString, matchesPattern } from '../utils/fs-helpers';

export type CancellationCheck = () => boolean;

/* ==================================================================
   STREAMING GENERATOR CLASS
   ================================================================== */

export class StreamingGenerator {
    private readonly cfg: Required<StructureConfig>;
    private readonly onProgress?: StreamProgressCallback;
    private readonly isCancelled?: CancellationCheck;

    private processed = 0;

    constructor(
        cfg: StructureConfig,
        onProgress?: StreamProgressCallback,
        isCancelled?: CancellationCheck
    ) {
        // Fill defaults
        this.cfg = {
            includeHidden: cfg.includeHidden ?? false,
            extensionFilter: cfg.extensionFilter ?? null,
            excludeFolders: cfg.excludeFolders ?? null,
            excludePatterns: cfg.excludePatterns ?? null,
            maxDepth: cfg.maxDepth ?? 0,
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

    /**
     * Main streaming generator. Yields events as files are discovered.
     * Memory usage stays constant regardless of repository size.
     */
    public async *generate(rootPath: string): AsyncGenerator<StreamEvent> {
        const start = Date.now();

        yield { kind: 'start', root: rootPath };

        // Stream the directory tree
        yield* this.streamDir(rootPath, '', 0);

        const durationMs = Date.now() - start;
        yield { kind: 'end', durationMs, totalItems: this.processed };
    }

    /**
     * Recursively stream directory contents
     */
    private async *streamDir(
        dir: string,
        prefix: string,
        depth: number
    ): AsyncGenerator<StreamEvent> {
        // Cancellation check
        if (this.isCancelled && this.isCancelled()) {
            throw new Error('Operation cancelled');
        }

        // Depth limit
        if (this.cfg.maxDepth && depth >= this.cfg.maxDepth) {
            return;
        }

        // Read directory
        let rawItems: fs.Dirent[];
        try {
            rawItems = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch (error) {
            // Skip unreadable directories
            return;
        }

        // Filter and sort
        const filtered = await this.filterAndSort(rawItems, dir);

        // Stream each item
        for (let i = 0; i < filtered.length; i++) {
            const item = filtered[i];
            const isLast = i === filtered.length - 1;
            const itemPath = path.join(dir, item.name);

            // Update progress
            this.processed++;
            if (this.processed % 100 === 0) {
                yield { kind: 'progress', processed: this.processed };
                if (this.onProgress) {
                    this.onProgress(this.processed, `Processing ${item.name}`);
                }
            }

            // Create entry
            const entry: FileEntry = {
                name: item.name,
                path: itemPath,
                type: item.isDirectory()
                    ? 'directory'
                    : item.isSymbolicLink()
                        ? 'symlink'
                        : 'file'
            };

            // Add metadata if requested
            await this.addMetadata(entry);

            if (item.isDirectory()) {
                // Check if we should compress this directory
                const shouldCompress = await this.shouldCompressDirectory(itemPath);

                yield { kind: 'directory-open', entry, prefix, isLast };

                if (!shouldCompress) {
                    // Recurse into directory
                    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
                    yield* this.streamDir(itemPath, nextPrefix, depth + 1);
                }

                yield { kind: 'directory-close' };
            } else {
                // Regular file
                yield { kind: 'file', entry, prefix, isLast };
            }
        }
    }

    /**
     * Add metadata to entry if configured
     */
    private async addMetadata(entry: FileEntry): Promise<void> {
        if (!this.cfg.includeSize && !this.cfg.includePermissions && !this.cfg.includeModifiedDate) {
            return;
        }

        const stats = await getStats(entry.path);
        if (stats) {
            if (this.cfg.includeSize) {
                entry.size = stats.size;
            }
            if (this.cfg.includePermissions) {
                entry.permissions = permissionsString(stats.mode);
            }
            if (this.cfg.includeModifiedDate) {
                entry.modified = stats.mtime;
            }
        }
    }

    /**
     * Check if directory should be compressed (too many items)
     */
    private async shouldCompressDirectory(dir: string): Promise<boolean> {
        if (!this.cfg.compressLargeDirs) {
            return false;
        }

        try {
            const items = await fs.promises.readdir(dir);
            return items.length > this.cfg.compressionThreshold!;
        } catch {
            return false;
        }
    }

    /**
     * Filter and sort directory items
     * (Reuses logic from non-streaming generator)
     */
    private async filterAndSort(
        items: fs.Dirent[],
        parentPath: string
    ): Promise<fs.Dirent[]> {
        // Hidden files
        let out = items.filter(i =>
            this.cfg.includeHidden || !i.name.startsWith('.')
        );

        // Folder exclusion
        if (this.cfg.excludeFolders) {
            out = out.filter(i =>
                !(i.isDirectory() && this.cfg.excludeFolders!.includes(i.name))
            );
        }

        // Extension whitelist
        if (this.cfg.extensionFilter && out.some(i => i.isFile())) {
            out = out.filter(i =>
                i.isFile()
                    ? this.cfg.extensionFilter!.includes(
                        path.extname(i.name).slice(1).toLowerCase()
                    )
                    : true
            );
        }

        // Glob pattern exclusions
        if (this.cfg.excludePatterns) {
            out = out.filter(i => {
                const full = path.join(parentPath, i.name);
                return !this.cfg.excludePatterns!.some(p => matchesPattern(full, p));
            });
        }

        // .gitignore handling
        if (this.cfg.respectGitignore) {
            const rules = await getGitignoreRules(parentPath);
            if (rules) {
                out = out.filter(i => {
                    const full = path.join(parentPath, i.name);
                    return !rules.isIgnored(full);
                });
            }
        }

        // Sort
        out.sort((a, b) => {
            if (this.cfg.sortBy === 'name') {
                if (a.isDirectory() && !b.isDirectory()) { return -1; }
                if (!a.isDirectory() && b.isDirectory()) { return 1; }
                return a.name.localeCompare(b.name, undefined, { numeric: true });
            }
            return 0;
        });

        return out;
    }
}
