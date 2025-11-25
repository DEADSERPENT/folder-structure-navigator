/* ==================================================================
   STREAMING FORMATTER
   Converts stream events to formatted output chunks
   Enables real-time writing without building full tree in memory
   ================================================================== */

import * as path from 'path';
import { StreamEvent } from '../models/stream.interface';
import { StructureConfig } from '../models/config.interface';
import { FileEntry } from '../models/file-entry.interface';
import { humanFileSize } from './fs-helpers';

/* ==================================================================
   STREAMING FORMATTER CLASS
   ================================================================== */

export class StreamingFormatter {
    private readonly cfg: Required<StructureConfig>;
    private jsonBuffer: any[] = []; // For JSON format, we need to buffer

    constructor(cfg: StructureConfig) {
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
    }

    /**
     * Format a single stream event into output text
     */
    public format(event: StreamEvent): string {
        switch (this.cfg.outputFormat) {
            case 'tree':
                return this.formatTreeEvent(event);
            case 'json':
                return this.formatJSONEvent(event);
            case 'markdown':
                return this.formatMarkdownEvent(event);
            case 'csv':
                return this.formatCSVEvent(event);
            case 'xml':
                return this.formatXMLEvent(event);
            default:
                return this.formatTreeEvent(event);
        }
    }

    /* ==================================================================
       TREE FORMAT
       ================================================================== */

    private formatTreeEvent(event: StreamEvent): string {
        switch (event.kind) {
            case 'start':
                return `📁 ${path.basename(event.root)}\n${'─'.repeat(50)}\n`;

            case 'file':
            case 'directory-open': {
                const connector = event.isLast ? '└── ' : '├── ';
                const icon = this.getIcon(event.entry);
                let line = `${event.prefix}${connector}${icon}${event.entry.name}`;

                // Add metadata
                if (this.cfg.includeSize && event.entry.size !== undefined) {
                    line += ` (${humanFileSize(event.entry.size)})`;
                }
                if (this.cfg.includePermissions && event.entry.permissions) {
                    line += ` [${event.entry.permissions}]`;
                }
                if (this.cfg.includeModifiedDate && event.entry.modified) {
                    line += ` ⏰ ${event.entry.modified.toISOString().split('T')[0]}`;
                }

                return line + '\n';
            }

            case 'end':
                return `\n⏱️  Generated in ${event.durationMs} ms\n📊 Total items: ${event.totalItems}\n`;

            default:
                return '';
        }
    }

    /* ==================================================================
       JSON FORMAT (requires buffering)
       ================================================================== */

    private formatJSONEvent(event: StreamEvent): string {
        switch (event.kind) {
            case 'start':
                this.jsonBuffer = [];
                return '{\n  "meta": {\n    "root": "' + event.root + '",\n';

            case 'file':
            case 'directory-open':
                this.jsonBuffer.push({
                    name: event.entry.name,
                    path: event.entry.path,
                    type: event.entry.type,
                    size: event.entry.size,
                    modified: event.entry.modified
                });
                return '';

            case 'end':
                const meta = `    "generationTime": "${event.durationMs}ms",\n    "totalItems": ${event.totalItems}\n  },\n`;
                const items = `  "items": ${JSON.stringify(this.jsonBuffer, null, 2)}\n}`;
                return meta + items;

            default:
                return '';
        }
    }

    /* ==================================================================
       MARKDOWN FORMAT
       ================================================================== */

    private formatMarkdownEvent(event: StreamEvent): string {
        switch (event.kind) {
            case 'start':
                return `# 📁 ${path.basename(event.root)}\n\n**Generated:** ${new Date().toISOString()}\n\n## Directory tree\n\`\`\`\n`;

            case 'file':
            case 'directory-open': {
                const connector = event.isLast ? '└── ' : '├── ';
                const icon = this.getIcon(event.entry);
                return `${event.prefix}${connector}${icon}${event.entry.name}\n`;
            }

            case 'end':
                return `\`\`\`\n\n**Generation time:** ${event.durationMs} ms\n**Items processed:** ${event.totalItems}\n`;

            default:
                return '';
        }
    }

    /* ==================================================================
       CSV FORMAT
       ================================================================== */

    private formatCSVEvent(event: StreamEvent): string {
        switch (event.kind) {
            case 'start':
                return 'Path,Type,Size (bytes),Permissions,Modified\n';

            case 'file':
            case 'directory-open': {
                const row = [
                    `"${event.entry.path}"`,
                    event.entry.type,
                    event.entry.size?.toString() ?? '',
                    event.entry.permissions ?? '',
                    event.entry.modified?.toISOString() ?? ''
                ].join(',');
                return row + '\n';
            }

            default:
                return '';
        }
    }

    /* ==================================================================
       XML FORMAT
       ================================================================== */

    private formatXMLEvent(event: StreamEvent): string {
        switch (event.kind) {
            case 'start':
                return `<?xml version="1.0" encoding="UTF-8"?>\n<folderStructure generated="${new Date().toISOString()}">\n`;

            case 'directory-open': {
                const attrs = this.buildXMLAttributes(event.entry);
                return `  <node ${attrs}>\n`;
            }

            case 'file': {
                const attrs = this.buildXMLAttributes(event.entry);
                return `  <node ${attrs} />\n`;
            }

            case 'directory-close':
                return `  </node>\n`;

            case 'end':
                return `</folderStructure>\n<!-- Generated in ${event.durationMs}ms -->\n`;

            default:
                return '';
        }
    }

    private buildXMLAttributes(entry: FileEntry): string {
        const attrs = [
            `name="${entry.name}"`,
            `type="${entry.type}"`,
            entry.size !== undefined ? `size="${entry.size}"` : '',
            entry.permissions ? `perm="${entry.permissions}"` : '',
            entry.modified ? `mod="${entry.modified.toISOString()}"` : ''
        ];
        return attrs.filter(Boolean).join(' ');
    }

    /* ==================================================================
       ICON HELPERS
       ================================================================== */

    private getIcon(entry: FileEntry): string {
        if (this.cfg.iconStyle === 'none') {
            return '';
        }

        // Custom icons
        const ext = path.extname(entry.name).toLowerCase();
        if (ext && this.cfg.customIcons[ext]) {
            return this.cfg.customIcons[ext] + ' ';
        }

        // Built-in icons
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

        const key = entry.type === 'directory'
            ? 'directory'
            : entry.type === 'symlink'
                ? 'symlink'
                : ext;

        const icon = emojiMap[key] || '📄';
        return this.cfg.iconStyle === 'emoji' ? icon + ' ' : '';
    }
}
