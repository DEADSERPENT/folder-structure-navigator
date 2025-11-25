/* ==================================================================
   FORMATTING UTILITIES
   Handles all output formatting (tree, JSON, markdown, XML, CSV)
   ================================================================== */

import * as path from 'path';
import { FileEntry } from '../models/file-entry.interface';
import { StructureConfig } from '../models/config.interface';
import { humanFileSize } from './fs-helpers';

/* ==================================================================
   ICON UTILITIES
   ================================================================== */

export function getIcon(entry: FileEntry, cfg: Required<StructureConfig>): string {
    if (cfg.iconStyle === 'none') {
        return '';
    }

    // 1️⃣ custom icons supplied by the user (extension → icon)
    if (cfg.customIcons) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext && cfg.customIcons[ext]) {
            return cfg.customIcons[ext] + ' ';
        }
    }

    // 2️⃣ built-in map – covers most common file types
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
    const defaultEmoji = cfg.iconStyle === 'emoji' ? '📄' : cfg.iconStyle === 'unicode' ? '📄' : cfg.iconStyle === 'ascii' ? '[F]' : '';

    const key = entry.type === 'directory'
        ? 'directory'
        : entry.type === 'symlink'
            ? 'symlink'
            : path.extname(entry.name).toLowerCase();

    return (emojiMap[key] || defaultEmoji) + ' ';
}

/* ==================================================================
   TREE FORMAT
   ================================================================== */

export function formatTree(
    entry: FileEntry,
    cfg: Required<StructureConfig>,
    prefix = '',
    genTime?: number
): string {
    // Use array join instead of string concatenation for better performance
    const lines: string[] = [];

    // Header for the root node (once)
    if (!prefix) {
        lines.push(`📁 ${entry.name}`);
        if (genTime !== undefined) {
            lines.push(`⏱️  Generated in ${genTime} ms`);
        }
        lines.push('─'.repeat(50));
    }

    if (!entry.children?.length) {
        return lines.join('\n');
    }

    for (let i = 0; i < entry.children.length; i++) {
        const child = entry.children[i];
        const isLast = i === entry.children.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const subPrefix = isLast ? '    ' : '│   ';

        const icon = getIcon(child, cfg);
        let line = `${prefix}${connector}${icon}${child.name}`;

        // optional metadata
        if (cfg.includeSize && child.size !== undefined) {
            line += ` (${humanFileSize(child.size)})`;
        }
        if (cfg.includePermissions && child.permissions) {
            line += ` [${child.permissions}]`;
        }
        if (cfg.includeModifiedDate && child.modified) {
            line += ` ⏰ ${child.modified.toISOString().split('T')[0]}`;
        }

        lines.push(line);

        // recurse
        if (child.children && child.children.length) {
            // Compression – collapse huge directories if requested
            if (cfg.compressLargeDirs && child.children.length > cfg.compressionThreshold!) {
                lines.push(`${prefix}${subPrefix}… (${child.children.length} items, collapsed)`);
            } else {
                lines.push(formatTree(child, cfg, prefix + subPrefix));
            }
        }
    }
    return lines.join('\n');
}

/* ==================================================================
   JSON FORMAT
   ================================================================== */

export function formatJSON(
    entry: FileEntry,
    cfg: Required<StructureConfig>,
    genTime: number,
    processed: number
): string {
    const meta = {
        generatedAt: new Date().toISOString(),
        generationTime: `${genTime}ms`,
        itemsProcessed: processed,
        config: cfg
    };
    return JSON.stringify({ meta, structure: entry }, null, 2);
}

/* ==================================================================
   MARKDOWN FORMAT
   ================================================================== */

export function formatMarkdown(
    entry: FileEntry,
    cfg: Required<StructureConfig>,
    genTime: number,
    processed: number
): string {
    let md = `# 📁 ${entry.name}\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Generation time:** ${genTime} ms\n`;
    md += `**Items processed:** ${processed}\n\n`;
    md += '## Directory tree\n```\n';
    md += formatTree(entry, cfg);
    md += '```\n';
    return md;
}

/* ==================================================================
   XML FORMAT
   ================================================================== */

export function formatXML(
    entry: FileEntry,
    genTime: number
): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<folderStructure generated="${new Date().toISOString()}" timeMs="${genTime}">\n`;
    xml += xmlNode(entry, 1);
    xml += `</folderStructure>\n`;
    return xml;
}

function xmlNode(node: FileEntry, indent: number): string {
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
        out += xmlNode(child, indent + 1);
    }
    out += `${pad}</node>\n`;
    return out;
}

/* ==================================================================
   CSV FORMAT
   ================================================================== */

export function formatCSV(root: FileEntry): string {
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
