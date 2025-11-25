/* ==================================================================
   FOLDER STRUCTURE NAVIGATOR – v2.0 (Refactored Architecture)
   Main extension entry point
   ================================================================== */

import * as vscode from 'vscode';
import { mainGenerate } from './commands/generate';
import { compareDirectoryStructures } from './commands/compare';
import { exportStructureCommand } from './commands/export';
import { generateWithAnalysisCommand } from './commands/analysis';
import { manageTemplatesCommand } from './commands/templates';
import { batchProcessCommand } from './commands/batch';
import { showPerformanceReportCommand } from './commands/performance';
import { applyPreset } from './utils/config';
import { AdvancedCache, gitignoreCache, statsCache } from './utils/cache';
import { PerformanceMonitor } from './utils/performance';

/* ==================================================================
   EXTENSION ACTIVATION
   ================================================================== */

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Advanced Folder Structure Navigator v2.0 is now active!');

    // -----------------------------------------------------------------
    // REGISTER ALL COMMANDS
    // -----------------------------------------------------------------

    // Main generation commands
    const generateStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateStructure',
        async (uri: vscode.Uri) => mainGenerate(uri, false)
    );

    const generateInteractiveStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateInteractiveStructure',
        async (uri: vscode.Uri) => mainGenerate(uri, true)
    );

    // Utility commands
    const compareDirectories = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.compareDirectories',
        () => compareDirectoryStructures()
    );

    const exportStructure = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.exportStructure',
        async (uri: vscode.Uri) => exportStructureCommand(uri)
    );

    const showPerformanceReport = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.showPerformanceReport',
        () => showPerformanceReportCommand()
    );

    const manageTemplates = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.manageTemplates',
        () => manageTemplatesCommand()
    );

    const batchProcess = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.batchProcess',
        () => batchProcessCommand()
    );

    const generateWithAnalysis = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.generateWithAnalysis',
        async (uri: vscode.Uri) => generateWithAnalysisCommand(uri)
    );

    // Preset commands
    const applyMinimalPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyMinimalPreset',
        () => applyPreset('minimal')
    );
    const applyDetailedPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyDetailedPreset',
        () => applyPreset('detailed')
    );
    const applyDocumentationPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyDocumentationPreset',
        () => applyPreset('documentation')
    );
    const applyDevelopmentPreset = vscode.commands.registerCommand(
        'advanced-folder-structure-navigator.applyDevelopmentPreset',
        () => applyPreset('development')
    );

    // -----------------------------------------------------------------
    // REGISTER ALL SUBSCRIPTIONS
    // -----------------------------------------------------------------
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

/* ==================================================================
   EXTENSION DEACTIVATION
   ================================================================== */

export function deactivate() {
    // Clear all caches
    AdvancedCache.getInstance().clear();
    gitignoreCache.clear();
    statsCache.clear();

    // Log final performance metrics
    const monitor = PerformanceMonitor.getInstance();
    console.log('🛑 Final Performance Report:\n', monitor.getMetricsReport());

    console.log('Advanced Folder Structure Navigator v2.0 deactivated');
}
