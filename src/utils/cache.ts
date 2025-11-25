/* ==================================================================
   CACHING UTILITIES
   Provides caching for file stats, gitignore rules, and general data
   ================================================================== */

import * as fs from 'fs';
import { GitignoreRules } from '../models/file-entry.interface';

/* ==================================================================
   GLOBAL CACHES (can be used by generators and workers)
   ================================================================== */

export const gitignoreCache = new Map<string, GitignoreRules>();
export const statsCache = new Map<string, fs.Stats>();

/* ==================================================================
   ADVANCED CACHE (TTL-based caching for general use)
   ================================================================== */

export class AdvancedCache {
    private static instance: AdvancedCache;
    private cache = new Map<string, { data: any; ts: number; ttl: number }>();
    private readonly defaultTTL = 5 * 60 * 1000; // 5 min

    private constructor() {}

    static getInstance(): AdvancedCache {
        if (!AdvancedCache.instance) {
            AdvancedCache.instance = new AdvancedCache();
        }
        return AdvancedCache.instance;
    }

    set(key: string, data: any, ttl = this.defaultTTL): void {
        this.cache.set(key, { data, ts: Date.now(), ttl });
        // occasional cleanup
        if (this.cache.size % 40 === 0) {
            this.cleanup();
        }
    }

    get(key: string): any {
        const rec = this.cache.get(key);
        if (!rec) {
            return null;
        }
        if (Date.now() - rec.ts > rec.ttl) {
            this.cache.delete(key);
            return null;
        }
        return rec.data;
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
        for (const [k, r] of this.cache.entries()) {
            if (now - r.ts > r.ttl) {
                this.cache.delete(k);
            }
        }
    }

    getCacheStats(): { size: number; hitRate: number } {
        return { size: this.cache.size, hitRate: 0 };
    }
}
