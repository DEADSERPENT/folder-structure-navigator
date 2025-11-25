import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { StreamingGenerator } from '../core/streaming-generator';
import { StreamingFormatter } from '../utils/streaming-formatter';
import { StructureConfig } from '../models/config.interface';
import { StreamEvent } from '../models/stream.interface';
import { gitignoreCache, statsCache } from '../utils/cache';

suite('Core: Streaming Generator Tests', () => {
    let tempDir: string;

    const createFile = (filePath: string, content: string = '') => {
        const fullPath = path.join(tempDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
    };

    setup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-test-'));
        gitignoreCache.clear();
        statsCache.clear();
    });

    teardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Streams events in correct order', async () => {
        createFile('file1.txt');
        createFile('src/main.ts');

        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StreamingGenerator(config);
        const events: StreamEvent[] = [];

        for await (const event of generator.generate(tempDir)) {
            events.push(event);
        }

        // Verify event sequence
        assert.ok(events.length > 0, 'Should emit events');
        assert.strictEqual(events[0].kind, 'start', 'First event should be start');
        assert.strictEqual(events[events.length - 1].kind, 'end', 'Last event should be end');

        // Check for file and directory events
        const hasFileEvent = events.some(e => e.kind === 'file');
        const hasDirEvent = events.some(e => e.kind === 'directory-open');

        assert.ok(hasFileEvent, 'Should emit file events');
        assert.ok(hasDirEvent, 'Should emit directory events');
    });

    test('Memory usage stays constant (no full tree in memory)', async () => {
        // Create many files
        for (let i = 0; i < 100; i++) {
            createFile(`file${i}.txt`);
        }

        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StreamingGenerator(config);
        let eventCount = 0;
        let maxMemoryDelta = 0;
        const initialMemory = process.memoryUsage().heapUsed;

        for await (const event of generator.generate(tempDir)) {
            eventCount++;
            const currentMemory = process.memoryUsage().heapUsed;
            const delta = currentMemory - initialMemory;
            maxMemoryDelta = Math.max(maxMemoryDelta, delta);

            // Event exists (not accumulating all in memory)
            assert.ok(event, 'Should yield events');
        }

        assert.ok(eventCount > 0, 'Should process events');

        // Memory delta should be reasonable (not loading all files into memory)
        // This is a soft check - streaming should use significantly less memory
        const memoryMB = maxMemoryDelta / (1024 * 1024);
        assert.ok(memoryMB < 50, `Memory usage should be low: ${memoryMB.toFixed(2)}MB`);
    });

    test('Progress events are emitted', async () => {
        for (let i = 0; i < 150; i++) {
            createFile(`file${i}.txt`);
        }

        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StreamingGenerator(config);
        let progressEvents = 0;

        for await (const event of generator.generate(tempDir)) {
            if (event.kind === 'progress') {
                progressEvents++;
            }
        }

        assert.ok(progressEvents > 0, 'Should emit progress events for large directories');
    });

    test('Calls cancellation check function', async () => {
        createFile('file1.txt');
        createFile('file2.txt');

        let checkCalled = false;
        const cancellationCheck = () => {
            checkCalled = true;
            return false; // Don't actually cancel
        };

        const config: StructureConfig = {
            outputFormat: 'tree'
        };

        const generator = new StreamingGenerator(config, undefined, cancellationCheck);

        for await (const event of generator.generate(tempDir)) {
            // Just consume events
        }

        assert.ok(checkCalled, 'Cancellation check should be called during generation');
    });

    test('Handles maxDepth correctly', async () => {
        createFile('level1/level2/level3/deep.txt');

        const config: StructureConfig = {
            maxDepth: 2,
            outputFormat: 'tree'
        };

        const generator = new StreamingGenerator(config);
        const events: StreamEvent[] = [];

        for await (const event of generator.generate(tempDir)) {
            events.push(event);
        }

        // Should have events for level1 but not level3
        const hasLevel1 = events.some(e =>
            (e.kind === 'directory-open' || e.kind === 'file') &&
            e.entry.name === 'level1'
        );

        const hasDeepFile = events.some(e =>
            e.kind === 'file' && e.entry.name === 'deep.txt'
        );

        assert.ok(hasLevel1, 'Should include level 1');
        assert.strictEqual(hasDeepFile, false, 'Should not include deep files beyond maxDepth');
    });

    test('Filters files correctly during streaming', async () => {
        createFile('script.js');
        createFile('readme.md');
        createFile('styles.css');

        const config: StructureConfig = {
            extensionFilter: ['js'],
            outputFormat: 'tree'
        };

        const generator = new StreamingGenerator(config);
        const files: string[] = [];

        for await (const event of generator.generate(tempDir)) {
            if (event.kind === 'file') {
                files.push(event.entry.name);
            }
        }

        assert.ok(files.includes('script.js'), 'Should include .js files');
        assert.strictEqual(files.includes('readme.md'), false, 'Should exclude .md files');
        assert.strictEqual(files.includes('styles.css'), false, 'Should exclude .css files');
    });
});

suite('Utils: Streaming Formatter Tests', () => {

    test('Formats tree events correctly', () => {
        const config: StructureConfig = { outputFormat: 'tree' };
        const formatter = new StreamingFormatter(config);

        const startEvent: StreamEvent = { kind: 'start', root: '/test' };
        const fileEvent: StreamEvent = {
            kind: 'file',
            entry: { name: 'test.txt', path: '/test/test.txt', type: 'file' },
            prefix: '',
            isLast: true
        };
        const endEvent: StreamEvent = { kind: 'end', durationMs: 100, totalItems: 5 };

        const startOutput = formatter.format(startEvent);
        const fileOutput = formatter.format(fileEvent);
        const endOutput = formatter.format(endEvent);

        assert.ok(startOutput.includes('test'), 'Start should include directory name');
        assert.ok(fileOutput.includes('test.txt'), 'File output should include filename');
        assert.ok(endOutput.includes('100 ms'), 'End should include duration');
    });

    test('Formats JSON events correctly', () => {
        const config: StructureConfig = { outputFormat: 'json' };
        const formatter = new StreamingFormatter(config);

        const startEvent: StreamEvent = { kind: 'start', root: '/test' };
        const fileEvent: StreamEvent = {
            kind: 'file',
            entry: { name: 'test.txt', path: '/test/test.txt', type: 'file' },
            prefix: '',
            isLast: true
        };
        const endEvent: StreamEvent = { kind: 'end', durationMs: 100, totalItems: 5 };

        const startOutput = formatter.format(startEvent);
        const fileOutput = formatter.format(fileEvent);
        const endOutput = formatter.format(endEvent);

        assert.ok(startOutput.includes('{'), 'JSON should start with {');
        assert.ok(endOutput.includes('}'), 'JSON should end with }');
    });

    test('Formats markdown events correctly', () => {
        const config: StructureConfig = { outputFormat: 'markdown' };
        const formatter = new StreamingFormatter(config);

        const startEvent: StreamEvent = { kind: 'start', root: '/test' };
        const endEvent: StreamEvent = { kind: 'end', durationMs: 100, totalItems: 5 };

        const startOutput = formatter.format(startEvent);
        const endOutput = formatter.format(endEvent);

        assert.ok(startOutput.includes('#'), 'Markdown should have heading');
        assert.ok(startOutput.includes('```'), 'Markdown should have code block');
        assert.ok(endOutput.includes('100 ms'), 'Should include generation time');
    });

    test('Formats CSV events correctly', () => {
        const config: StructureConfig = { outputFormat: 'csv' };
        const formatter = new StreamingFormatter(config);

        const startEvent: StreamEvent = { kind: 'start', root: '/test' };
        const fileEvent: StreamEvent = {
            kind: 'file',
            entry: { name: 'test.txt', path: '/test/test.txt', type: 'file' },
            prefix: '',
            isLast: true
        };

        const startOutput = formatter.format(startEvent);
        const fileOutput = formatter.format(fileEvent);

        assert.ok(startOutput.includes('Path'), 'CSV should have header');
        assert.ok(fileOutput.includes('test.txt'), 'CSV should include filename');
        assert.ok(fileOutput.includes(','), 'CSV should be comma-separated');
    });

    test('Includes metadata when configured', () => {
        const config: StructureConfig = {
            outputFormat: 'tree',
            includeSize: true,
            includePermissions: true
        };
        const formatter = new StreamingFormatter(config);

        const fileEvent: StreamEvent = {
            kind: 'file',
            entry: {
                name: 'test.txt',
                path: '/test/test.txt',
                type: 'file',
                size: 1024,
                permissions: 'rw-r--r--'
            },
            prefix: '',
            isLast: true
        };

        const output = formatter.format(fileEvent);

        assert.ok(output.includes('KB') || output.includes('B'), 'Should include size');
        assert.ok(output.includes('rw-r--r--'), 'Should include permissions');
    });
});
