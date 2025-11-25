/* ==================================================================
   STREAMING INTERFACE
   Event-based streaming for memory-efficient generation
   ================================================================== */

import { FileEntry } from './file-entry.interface';

/**
 * Stream events emitted during directory traversal.
 * Allows consumers to process items as they're discovered
 * rather than building the entire tree in memory.
 */
export type StreamEvent =
    | { kind: 'start'; root: string }
    | { kind: 'file'; entry: FileEntry; prefix: string; isLast: boolean }
    | { kind: 'directory-open'; entry: FileEntry; prefix: string; isLast: boolean }
    | { kind: 'directory-close' }
    | { kind: 'progress'; processed: number }
    | { kind: 'end'; durationMs: number; totalItems: number };

/**
 * Callback type for streaming progress updates
 */
export type StreamProgressCallback = (processed: number, message: string) => void;
