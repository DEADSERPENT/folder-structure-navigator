import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {

	console.log('Advanced Folder Structure Navigator is now active!');

	let generateStructure = vscode.commands.registerCommand('advanced-folder-structure-navigator.generateStructure', async (uri: vscode.Uri) => {
		if (!uri) {
			vscode.window.showErrorMessage('Please right-click on a folder to generate the structure.');
			return;
		}
		const structure = buildTree(uri.fsPath);
		vscode.workspace.openTextDocument({ content: structure, language: 'plaintext' })
			.then(doc => vscode.window.showTextDocument(doc));
	});

	let createFileAndGitignore = vscode.commands.registerCommand('advanced-folder-structure-navigator.createFileAndGitignore', async (uri: vscode.Uri) => {
		if (!uri) {
			vscode.window.showErrorMessage('Please right-click on a folder.');
			return;
		}
		const fileName = await vscode.window.showInputBox({ prompt: 'Enter file name (with path if needed):' });
		if (!fileName) {
			return;
		}
		const newFilePath = path.join(uri.fsPath, fileName);
		fs.mkdirSync(path.dirname(newFilePath), { recursive: true });
		fs.writeFileSync(newFilePath, '');

		const gitignorePath = findNearestGitignore(uri.fsPath);
		if (gitignorePath) {
			const relativePath = path.relative(path.dirname(gitignorePath), newFilePath).replace(/\\/g, '/');
			const shouldIgnore = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: `Add ${relativePath} to .gitignore?` });
			if (shouldIgnore === 'Yes') {
				let existing = fs.readFileSync(gitignorePath, 'utf8');
				if (!existing.includes(relativePath)) {
					fs.appendFileSync(gitignorePath, `\n${relativePath}`);
				}
			}
		}
		vscode.window.showInformationMessage(`Created ${fileName} under ${uri.fsPath}`);
	});

	context.subscriptions.push(generateStructure);
	context.subscriptions.push(createFileAndGitignore);
}

function buildTree(dirPath: string, prefix: string = ''): string {
	let tree = '';
	const items = fs.readdirSync(dirPath, { withFileTypes: true });
	const entries = items.filter(i => !i.name.startsWith('.'));
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		const pointer = i === entries.length - 1 ? '└── ' : '├── ';
		tree += `${prefix}${pointer}${entry.name}\n`;
		if (entry.isDirectory()) {
			tree += buildTree(path.join(dirPath, entry.name), prefix + (i === entries.length - 1 ? '    ' : '│   '));
		}
	}
	return tree;
}

function findNearestGitignore(startPath: string): string | null {
	let currentPath = startPath;
	while (currentPath !== path.dirname(currentPath)) {
		const candidate = path.join(currentPath, '.gitignore');
		if (fs.existsSync(candidate)) {
			return candidate;
		}
		currentPath = path.dirname(currentPath);
	}
	return null;
}

export function deactivate() {}
