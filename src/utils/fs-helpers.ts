/* ==================================================================
   FILESYSTEM HELPERS
   Utilities for filesystem operations, gitignore parsing, etc.
   ================================================================== */

import * as fs from 'fs';
import * as path from 'path';
import { GitignoreRules } from '../models/file-entry.interface';
import { gitignoreCache, statsCache } from './cache';

/* ==================================================================
   DIRECTORY VALIDATION
   ================================================================== */

export async function isValidDirectory(p: string): Promise<boolean> {
    try {
        const s = await fs.promises.stat(p);
        return s.isDirectory();
    } catch {
        return false;
    }
}

/* ==================================================================
   GITIGNORE UTILITIES
   ================================================================== */

export async function getGitignoreRules(dir: string): Promise<GitignoreRules | null> {
    if (gitignoreCache.has(dir)) {
        return gitignoreCache.get(dir)!;
    }
    const nearest = await findNearestGitignore(dir);
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
            return patterns.some(p => matchesPattern(rel, p));
        }
    };
    gitignoreCache.set(dir, rules);
    return rules;
}

async function findNearestGitignore(start: string): Promise<string | null> {
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

export function matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to RegExp
    // First, escape special regex characters except * and ?
    let regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
        .replace(/\*\*/g, '\x00')               // Placeholder for **
        .replace(/\*/g, '[^/\\\\]*')            // * matches anything except path separator
        .replace(/\x00/g, '.*')                 // ** matches anything including path separator
        .replace(/\?/g, '[^/\\\\]');            // ? matches single char except path separator

    // Make it work for both absolute and relative paths
    // If pattern doesn't start with path separator, match against basename
    const testPath = pattern.includes('/') || pattern.includes('\\')
        ? filePath
        : path.basename(filePath);

    try {
        return new RegExp(`^${regexPattern}$`).test(testPath);
    } catch {
        // If regex is invalid, fall back to simple string matching
        return filePath.includes(pattern);
    }
}

/* ==================================================================
   FILE STATS WITH CACHING
   ================================================================== */

export async function getStats(p: string): Promise<fs.Stats | null> {
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

export function permissionsString(mode: number): string {
    const map = ['r', 'w', 'x'];
    let str = '';
    for (let i = 8; i >= 0; i--) {
        str += (mode & (1 << i)) ? map[(8 - i) % 3] : '-';
    }
    return str;
}

/* ==================================================================
   FILE SIZE FORMATTING
   ================================================================== */

export function humanFileSize(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const num = (bytes / Math.pow(1024, i)).toFixed(1);
    return `${num} ${units[i]}`;
}
