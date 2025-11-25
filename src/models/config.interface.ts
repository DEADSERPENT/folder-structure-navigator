/* ==================================================================
   CONFIGURATION INTERFACE
   All configuration options for the folder structure generator
   ================================================================== */

export interface StructureConfig {
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
    includeModifiedDate?: boolean;

    // ---- UI / output ------------------------------------------------
    sortBy?: 'name' | 'size' | 'modified' | 'type';
    outputFormat?: 'tree' | 'json' | 'markdown' | 'xml' | 'csv';
    useWorker?: boolean;
    useStreaming?: boolean;              // NEW - streaming mode for memory efficiency

    // ---- visual tweaks -----------------------------------------------
    iconStyle?: 'emoji' | 'unicode' | 'ascii' | 'none';
    customIcons?: Record<string, string>;

    // ---- compression of large directories -----------------------------
    compressLargeDirs?: boolean;
    compressionThreshold?: number;

    // ---- auto-behaviour ------------------------------------------------
    autoSave?: boolean;
    autoOpen?: boolean;
}
