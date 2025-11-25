/* ==================================================================
   PERFORMANCE REPORT COMMAND
   ================================================================== */

import * as vscode from 'vscode';
import { PerformanceMonitor } from '../utils/performance';

export async function showPerformanceReportCommand(): Promise<void> {
    const rep = PerformanceMonitor.getInstance().getMetricsReport();
    const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse('untitled:performance-report.md')
    );
    const ed = await vscode.window.showTextDocument(doc);
    await ed.edit(e => e.insert(new vscode.Position(0, 0), rep));
}
