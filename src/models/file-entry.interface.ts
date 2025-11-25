/* ==================================================================
   FILE ENTRY INTERFACE
   Internal model used while building the directory tree
   ================================================================== */

export interface FileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'symlink';
    size?: number;
    modified?: Date;
    permissions?: string;
    children?: FileEntry[];
}

/* ==================================================================
   GITIGNORE RULES INTERFACE
   ================================================================== */

export interface GitignoreRules {
    patterns: string[];
    isIgnored: (filePath: string) => boolean;
}

/* ==================================================================
   PLUGIN INTERFACE (for future extensibility)
   ================================================================== */

export interface StructurePlugin {
    name: string;
    version: string;
    processEntry?(entry: FileEntry): FileEntry;
    formatOutput?(structure: string, format: string): string;
    addCommands?(context: any): void;
}
