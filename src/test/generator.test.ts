import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import your NEW core modules
import { StructureGenerator } from '../core/generator';
import { StructureConfig } from '../models/config.interface';
import { gitignoreCache, statsCache } from '../utils/cache';

suite('Core: StructureGenerator Tests', () => {
    let tempDir: string;

    // Helper to create dummy files
    const createFile = (filePath: string, content: string = '') => {
        const fullPath = path.join(tempDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
    };

    // Setup: Create a temporary directory before tests
    setup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-test-'));

        // Clear caches between tests to ensure isolation
        gitignoreCache.clear();
        statsCache.clear();
    });

    // Teardown: Cleanup files after tests
    teardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Generates simple tree structure', async () => {
        createFile('file1.txt');
        createFile('src/main.ts');

        const config: StructureConfig = {
            maxDepth: 10,
            includeHidden: false,
            outputFormat: 'tree',
            sortBy: 'name'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        // Verify the output string contains our files
        assert.ok(result.includes('file1.txt'), 'Output should contain file1.txt');
        assert.ok(result.includes('src'), 'Output should contain src folder');
        assert.ok(result.includes('main.ts'), 'Output should contain main.ts');
    });

    test('Respects maxDepth setting', async () => {
        createFile('level1/level2/level3/deep.txt');

        const config: StructureConfig = {
            maxDepth: 1, // Only show root children
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('level1'), 'Should show level 1');
        assert.strictEqual(result.includes('level2'), false, 'Should NOT show level 2 due to depth limit');
    });

    test('Filters by extension', async () => {
        createFile('script.js');
        createFile('readme.md');
        createFile('styles.css');

        const config: StructureConfig = {
            extensionFilter: ['js', 'css'], // Whitelist JS and CSS
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('script.js'));
        assert.ok(result.includes('styles.css'));
        assert.strictEqual(result.includes('readme.md'), false, 'Should exclude markdown files');
    });

    test('Excludes specified folders', async () => {
        createFile('src/code.ts');
        createFile('node_modules/package/index.js');
        createFile('dist/bundle.js');

        const config: StructureConfig = {
            excludeFolders: ['node_modules', 'dist'],
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('src'));
        assert.strictEqual(result.includes('node_modules'), false, 'Should exclude node_modules');
        assert.strictEqual(result.includes('dist'), false, 'Should exclude dist');
    });

    test('Respects .gitignore', async () => {
        createFile('.gitignore', 'secret.txt\n*.log');
        createFile('secret.txt');
        createFile('error.log');
        createFile('safe.txt');

        const config: StructureConfig = {
            respectGitignore: true,
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('safe.txt'), 'Should include non-ignored file');
        assert.strictEqual(result.includes('secret.txt'), false, 'Should exclude secret.txt');
        assert.strictEqual(result.includes('error.log'), false, 'Should exclude .log files');
    });

    test('Hides hidden files by default', async () => {
        createFile('.hidden');
        createFile('visible.txt');

        const config: StructureConfig = {
            includeHidden: false,
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('visible.txt'));
        assert.strictEqual(result.includes('.hidden'), false, 'Should exclude hidden files');
    });

    test('Shows hidden files when configured', async () => {
        createFile('.hidden');
        createFile('visible.txt');

        const config: StructureConfig = {
            includeHidden: true,
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('visible.txt'));
        assert.ok(result.includes('.hidden'), 'Should include hidden files when configured');
    });

    test('Includes file sizes when requested', async () => {
        createFile('small.txt', 'Hello');

        const config: StructureConfig = {
            includeSize: true,
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        // Should contain size information (B, KB, etc.)
        assert.ok(result.includes('small.txt'));
        assert.ok(/\d+\.\d+\s+[KMGT]?B/.test(result) || result.includes('B'),
            'Should include file size information');
    });

    test('Generates JSON format correctly', async () => {
        createFile('test.js');

        const config: StructureConfig = {
            outputFormat: 'json'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        // Verify it's valid JSON
        assert.doesNotThrow(() => {
            const parsed = JSON.parse(result);
            assert.ok(parsed.structure, 'JSON should have structure property');
            assert.ok(parsed.meta, 'JSON should have meta property');
        }, 'Output should be valid JSON');
    });

    test('Generates Markdown format correctly', async () => {
        createFile('readme.md');

        const config: StructureConfig = {
            outputFormat: 'markdown'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.startsWith('#'), 'Markdown should start with heading');
        assert.ok(result.includes('```'), 'Markdown should include code blocks');
    });

    test('Excludes patterns using glob syntax', async () => {
        createFile('test.log');
        createFile('temp/cache.tmp');
        createFile('important.txt');

        const config: StructureConfig = {
            excludePatterns: ['*.log', '*.tmp'],
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('important.txt'));
        assert.strictEqual(result.includes('test.log'), false, 'Should exclude .log files');
        assert.strictEqual(result.includes('cache.tmp'), false, 'Should exclude .tmp files');
    });

    test('Handles empty directory', async () => {
        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        // Should not throw and should contain the directory name
        assert.ok(result.length > 0);
        assert.ok(result.includes(path.basename(tempDir)));
    });

    test('Sorts files correctly', async () => {
        createFile('zebra.txt');
        createFile('apple.txt');
        createFile('banana.txt');

        const config: StructureConfig = {
            sortBy: 'name',
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        // Check that files appear in alphabetical order
        const appleIndex = result.indexOf('apple.txt');
        const bananaIndex = result.indexOf('banana.txt');
        const zebraIndex = result.indexOf('zebra.txt');

        assert.ok(appleIndex < bananaIndex, 'apple should come before banana');
        assert.ok(bananaIndex < zebraIndex, 'banana should come before zebra');
    });

    test('Compresses large directories when configured', async () => {
        // Create a directory with many files
        for (let i = 0; i < 60; i++) {
            createFile(`large-dir/file${i}.txt`);
        }

        const config: StructureConfig = {
            compressLargeDirs: true,
            compressionThreshold: 50,
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        // Should show compression message
        assert.ok(result.includes('collapsed') || result.includes('items'),
            'Should indicate directory compression');
    });

    test('Progress callback is called during generation', async () => {
        createFile('file1.txt');
        createFile('file2.txt');
        createFile('file3.txt');

        let progressCalls = 0;
        const progressCallback = (increment: number, message: string) => {
            progressCalls++;
        };

        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config, progressCallback);
        await generator.generate(tempDir);

        assert.ok(progressCalls > 0, 'Progress callback should be called at least once');
    });

    test('Cancellation check is respected', async () => {
        createFile('file1.txt');
        createFile('file2.txt');

        let shouldCancel = true;
        const cancellationCheck = () => shouldCancel;

        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config, undefined, cancellationCheck);

        await assert.rejects(
            async () => {
                await generator.generate(tempDir);
            },
            /cancelled/i,
            'Should throw cancellation error'
        );
    });

    test('Handles nested directory structures', async () => {
        createFile('src/components/Button.tsx');
        createFile('src/components/Input.tsx');
        createFile('src/utils/helpers.ts');
        createFile('tests/unit/button.test.ts');

        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StructureGenerator(config);
        const result = await generator.generate(tempDir);

        assert.ok(result.includes('src'));
        assert.ok(result.includes('components'));
        assert.ok(result.includes('Button.tsx'));
        assert.ok(result.includes('utils'));
        assert.ok(result.includes('tests'));
    });
});
