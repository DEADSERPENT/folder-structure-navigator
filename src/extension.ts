import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	console.log('Advanced Folder Structure Navigator is now active!');

	const generateStructure = vscode.commands.registerCommand('advanced-folder-structure-navigator.generateStructure', async (uri: vscode.Uri) => {
		try {
			if (!uri) {
				vscode.window.showErrorMessage('Please right-click on a folder to generate the structure.');
				return;
			}

			// Check if path exists and is a directory
			if (!fs.existsSync(uri.fsPath) || !fs.statSync(uri.fsPath).isDirectory()) {
				vscode.window.showErrorMessage('Selected path is not a valid directory.');
				return;
			}

			const structure = await buildTree(uri.fsPath);
			
			// Get configuration for output options
			const config = vscode.workspace.getConfiguration('advanced-folder-structure-navigator');
			const outputFileName = config.get<string>('outputFileName') || 'structure.txt';
			const includeHiddenFiles = config.get<boolean>('includeHiddenFiles') || false;
			
			const filePath = path.join(uri.fsPath, outputFileName);
			
			// Use promises for file operations
			await fs.promises.writeFile(filePath, structure, 'utf8');

			// Notify the user with action buttons
			const action = await vscode.window.showInformationMessage(
				`Folder structure saved to ${outputFileName}`,
				'Open File',
				'Copy to Clipboard'
			);

			if (action === 'Open File') {
				const doc = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(doc);
			} else if (action === 'Copy to Clipboard') {
				await vscode.env.clipboard.writeText(structure);
				vscode.window.showInformationMessage('Structure copied to clipboard!');
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Error generating structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});
	
	// New command to generate structure with custom filters
	const generateCustomStructure = vscode.commands.registerCommand('advanced-folder-structure-navigator.generateCustomStructure', async (uri: vscode.Uri) => {
		try {
			if (!uri) {
				vscode.window.showErrorMessage('Please right-click on a folder to generate the structure.');
				return;
			}

			const options = await vscode.window.showQuickPick([
				'Include hidden files',
				'Include only specific extensions',
				'Exclude specific folders',
				'Standard structure'
			], {
				placeHolder: 'Select structure generation options',
				canPickMany: true
			});

			if (!options) {
				return;
			}

			const config = {
				includeHidden: options.includes('Include hidden files'),
				extensionFilter: null as string[] | null,
				excludeFolders: null as string[] | null
			};

			if (options.includes('Include only specific extensions')) {
				const extensions = await vscode.window.showInputBox({
					prompt: 'Enter file extensions (comma-separated, e.g., js,ts,json):',
					validateInput: (value) => {
						if (value && !value.match(/^[a-zA-Z0-9,\s]+$/)) {
							return 'Invalid format. Use comma-separated extensions without dots.';
						}
						return null;
					}
				});
				if (extensions) {
					config.extensionFilter = extensions.split(',').map(ext => ext.trim().toLowerCase());
				}
			}

			if (options.includes('Exclude specific folders')) {
				const folders = await vscode.window.showInputBox({
					prompt: 'Enter folder names to exclude (comma-separated):',
				});
				if (folders) {
					config.excludeFolders = folders.split(',').map(folder => folder.trim());
				}
			}

			const structure = await buildTree(uri.fsPath, '', config);
			const filePath = path.join(uri.fsPath, 'custom_structure.txt');
			
			await fs.promises.writeFile(filePath, structure, 'utf8');
			
			const doc = await vscode.workspace.openTextDocument(filePath);
			await vscode.window.showTextDocument(doc);
			
			vscode.window.showInformationMessage('Custom structure generated successfully!');
		} catch (error) {
			vscode.window.showErrorMessage(`Error generating custom structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	context.subscriptions.push(generateStructure,  generateCustomStructure);
}

async function buildTree(dirPath: string, prefix: string = '', config?: {
	includeHidden?: boolean;
	extensionFilter?: string[] | null;
	excludeFolders?: string[] | null;
}): Promise<string> {
	let tree = '';
	
	try {
		const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
		
		let entries = items.filter(item => {
			// Filter hidden files
			if (!config?.includeHidden && item.name.startsWith('.')) {
				return false;
			}
			
			// Filter excluded folders
			if (config?.excludeFolders && item.isDirectory() && 
				config.excludeFolders.includes(item.name)) {
				return false;
			}
			
			// Filter by extension
			if (config?.extensionFilter && item.isFile()) {
				const ext = path.extname(item.name).slice(1).toLowerCase();
				return config.extensionFilter.includes(ext);
			}
			
			return true;
		});

		// Sort entries: directories first, then files
		entries.sort((a, b) => {
			if (a.isDirectory() && !b.isDirectory()) {
				return -1;
			}
			if (!a.isDirectory() && b.isDirectory()) {
				return 1;
			}
			return a.name.localeCompare(b.name);
		});

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const pointer = i === entries.length - 1 ? '└── ' : '├── ';
			const icon = entry.isDirectory() ? '📁 ' : '📄 ';
			tree += `${prefix}${pointer}${icon}${entry.name}\n`;
			
			if (entry.isDirectory()) {
				const nextPrefix = prefix + (i === entries.length - 1 ? '    ' : '│   ');
				tree += await buildTree(path.join(dirPath, entry.name), nextPrefix, config);
			}
		}
	} catch (error) {
		tree += `${prefix}└── ❌ Error reading directory: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
	}
	
	return tree;
}

async function findNearestGitignore(startPath: string): Promise<string | null> {
	let currentPath = startPath;
	
	while (currentPath !== path.dirname(currentPath)) {
		const candidate = path.join(currentPath, '.gitignore');
		
		try {
			await fs.promises.access(candidate);
			return candidate;
		} catch {
			// File doesn't exist, continue searching
		}
		
		currentPath = path.dirname(currentPath);
	}
	
	return null;
}

export function deactivate() {}