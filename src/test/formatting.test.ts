import * as assert from 'assert';
import { FileEntry } from '../models/file-entry.interface';
import { StructureConfig } from '../models/config.interface';
import { formatTree, formatJSON, formatMarkdown, formatXML, formatCSV, getIcon } from '../utils/formatting';

suite('Utils: Formatting Tests', () => {

    const createSampleTree = (): FileEntry => {
        return {
            name: 'project',
            path: '/project',
            type: 'directory',
            children: [
                {
                    name: 'src',
                    path: '/project/src',
                    type: 'directory',
                    children: [
                        {
                            name: 'main.ts',
                            path: '/project/src/main.ts',
                            type: 'file',
                            size: 1024
                        }
                    ]
                },
                {
                    name: 'README.md',
                    path: '/project/README.md',
                    type: 'file',
                    size: 512
                }
            ]
        };
    };

    const defaultConfig: Required<StructureConfig> = {
        includeHidden: false,
        extensionFilter: null,
        excludeFolders: null,
        excludePatterns: null,
        maxDepth: 0,
        respectGitignore: true,
        includeSize: false,
        includePermissions: false,
        includeModifiedDate: false,
        sortBy: 'name',
        outputFormat: 'tree',
        useWorker: false,
        useStreaming: false,
        iconStyle: 'emoji',
        customIcons: {},
        compressLargeDirs: false,
        compressionThreshold: 50,
        autoSave: true,
        autoOpen: true
    };

    test('formatTree generates valid tree structure', () => {
        const tree = createSampleTree();
        const result = formatTree(tree, defaultConfig);

        assert.ok(result.includes('project'), 'Should include root name');
        assert.ok(result.includes('src'), 'Should include src directory');
        assert.ok(result.includes('main.ts'), 'Should include main.ts file');
        assert.ok(result.includes('README.md'), 'Should include README.md file');

        // Check for tree characters
        assert.ok(result.includes('├──') || result.includes('└──'), 'Should include tree connectors');
    });

    test('formatTree includes file sizes when configured', () => {
        const tree = createSampleTree();
        const config = { ...defaultConfig, includeSize: true };
        const result = formatTree(tree, config);

        // Should include size information
        assert.ok(/\d+\.\d+\s+[KMGT]?B/.test(result) || result.includes('B'),
            'Should include file size information');
    });

    test('formatJSON generates valid JSON', () => {
        const tree = createSampleTree();
        const result = formatJSON(tree, defaultConfig, 100, 5);

        assert.doesNotThrow(() => {
            const parsed = JSON.parse(result);
            assert.ok(parsed.structure, 'JSON should have structure');
            assert.ok(parsed.meta, 'JSON should have meta');
            assert.strictEqual(parsed.meta.generationTime, '100ms');
            assert.strictEqual(parsed.meta.itemsProcessed, 5);
        });
    });

    test('formatMarkdown generates valid markdown', () => {
        const tree = createSampleTree();
        const result = formatMarkdown(tree, defaultConfig, 100, 5);

        assert.ok(result.startsWith('#'), 'Should start with markdown heading');
        assert.ok(result.includes('```'), 'Should include code blocks');
        assert.ok(result.includes('project'), 'Should include project name');
        assert.ok(result.includes('Generated:'), 'Should include generation metadata');
    });

    test('formatXML generates valid XML structure', () => {
        const tree = createSampleTree();
        const result = formatXML(tree, 100);

        assert.ok(result.includes('<?xml'), 'Should include XML declaration');
        assert.ok(result.includes('<folderStructure'), 'Should include root element');
        assert.ok(result.includes('</folderStructure>'), 'Should close root element');
        assert.ok(result.includes('name="project"'), 'Should include project name');
    });

    test('formatCSV generates valid CSV', () => {
        const tree = createSampleTree();
        const result = formatCSV(tree);

        const lines = result.split('\n');
        assert.ok(lines.length > 0, 'Should have at least one line');
        assert.ok(lines[0].includes('Path'), 'Header should include Path');
        assert.ok(lines[0].includes('Type'), 'Header should include Type');
        assert.ok(result.includes('main.ts'), 'Should include file names');
    });

    test('getIcon returns correct icons for file types', () => {
        const fileEntry: FileEntry = {
            name: 'test.ts',
            path: '/test.ts',
            type: 'file'
        };

        const dirEntry: FileEntry = {
            name: 'src',
            path: '/src',
            type: 'directory'
        };

        const emojiConfig = { ...defaultConfig, iconStyle: 'emoji' as const };
        const noneConfig = { ...defaultConfig, iconStyle: 'none' as const };

        const fileIcon = getIcon(fileEntry, emojiConfig);
        const dirIcon = getIcon(dirEntry, emojiConfig);
        const noIcon = getIcon(fileEntry, noneConfig);

        assert.ok(fileIcon.length > 0, 'Should return icon for file');
        assert.ok(dirIcon.length > 0, 'Should return icon for directory');
        assert.strictEqual(noIcon, '', 'Should return empty string when icons disabled');
    });

    test('getIcon respects custom icons', () => {
        const fileEntry: FileEntry = {
            name: 'test.vue',
            path: '/test.vue',
            type: 'file'
        };

        const config = {
            ...defaultConfig,
            customIcons: { '.vue': '🎨' }
        };

        const icon = getIcon(fileEntry, config);
        assert.ok(icon.includes('🎨'), 'Should use custom icon for .vue files');
    });

    test('formatTree handles compression for large directories', () => {
        const largeTree: FileEntry = {
            name: 'project',
            path: '/project',
            type: 'directory',
            children: [
                {
                    name: 'large-dir',
                    path: '/project/large-dir',
                    type: 'directory',
                    children: Array.from({ length: 60 }, (_, i) => ({
                        name: `file${i}.txt`,
                        path: `/project/large-dir/file${i}.txt`,
                        type: 'file' as const
                    }))
                }
            ]
        };

        const config = {
            ...defaultConfig,
            compressLargeDirs: true,
            compressionThreshold: 50
        };

        const result = formatTree(largeTree, config);
        assert.ok(result.includes('collapsed') || result.includes('60 items'),
            'Should indicate compression of large directory');
    });

    test('formatTree handles empty directories', () => {
        const emptyTree: FileEntry = {
            name: 'empty',
            path: '/empty',
            type: 'directory',
            children: []
        };

        const result = formatTree(emptyTree, defaultConfig);
        assert.ok(result.includes('empty'), 'Should include directory name');
        assert.ok(result.length > 0, 'Should produce output');
    });

    test('formatTree includes permissions when configured', () => {
        const tree: FileEntry = {
            name: 'project',
            path: '/project',
            type: 'directory',
            children: [
                {
                    name: 'script.sh',
                    path: '/project/script.sh',
                    type: 'file',
                    permissions: 'rwxr-xr-x'
                }
            ]
        };

        const config = { ...defaultConfig, includePermissions: true };
        const result = formatTree(tree, config);

        assert.ok(result.includes('rwxr-xr-x'), 'Should include permission string');
    });

    test('formatTree includes modified date when configured', () => {
        const tree: FileEntry = {
            name: 'project',
            path: '/project',
            type: 'directory',
            children: [
                {
                    name: 'file.txt',
                    path: '/project/file.txt',
                    type: 'file',
                    modified: new Date('2025-01-01')
                }
            ]
        };

        const config = { ...defaultConfig, includeModifiedDate: true };
        const result = formatTree(tree, config);

        assert.ok(result.includes('2025'), 'Should include year from modified date');
    });
});
