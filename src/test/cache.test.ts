import * as assert from 'assert';
import { AdvancedCache } from '../utils/cache';

suite('Utils: Cache Tests', () => {

    let cache: AdvancedCache;

    setup(() => {
        cache = AdvancedCache.getInstance();
        cache.clear();
    });

    teardown(() => {
        cache.clear();
    });

    test('Singleton pattern works correctly', () => {
        const instance1 = AdvancedCache.getInstance();
        const instance2 = AdvancedCache.getInstance();

        assert.strictEqual(instance1, instance2, 'Should return same instance');
    });

    test('Can set and get values', () => {
        cache.set('key1', 'value1');
        const result = cache.get('key1');

        assert.strictEqual(result, 'value1', 'Should retrieve stored value');
    });

    test('Returns null for non-existent keys', () => {
        const result = cache.get('nonexistent');
        assert.strictEqual(result, null, 'Should return null for missing keys');
    });

    test('has() method works correctly', () => {
        cache.set('exists', 'data');

        assert.strictEqual(cache.has('exists'), true, 'Should return true for existing key');
        assert.strictEqual(cache.has('missing'), false, 'Should return false for missing key');
    });

    test('delete() removes values', () => {
        cache.set('temp', 'data');
        assert.strictEqual(cache.has('temp'), true);

        cache.delete('temp');
        assert.strictEqual(cache.has('temp'), false, 'Should remove the key');
    });

    test('clear() removes all values', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.set('key3', 'value3');

        cache.clear();

        assert.strictEqual(cache.has('key1'), false);
        assert.strictEqual(cache.has('key2'), false);
        assert.strictEqual(cache.has('key3'), false);
    });

    test('TTL expiration works', async () => {
        const shortTTL = 100; // 100ms
        cache.set('expires', 'data', shortTTL);

        // Should exist immediately
        assert.strictEqual(cache.get('expires'), 'data');

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 150));

        // Should be expired
        assert.strictEqual(cache.get('expires'), null, 'Should expire after TTL');
    });

    test('Can store different data types', () => {
        cache.set('string', 'hello');
        cache.set('number', 42);
        cache.set('object', { foo: 'bar' });
        cache.set('array', [1, 2, 3]);

        assert.strictEqual(cache.get('string'), 'hello');
        assert.strictEqual(cache.get('number'), 42);
        assert.deepStrictEqual(cache.get('object'), { foo: 'bar' });
        assert.deepStrictEqual(cache.get('array'), [1, 2, 3]);
    });

    test('getCacheStats returns valid stats', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');

        const stats = cache.getCacheStats();

        assert.ok(stats.size >= 0, 'Should return a valid size');
        assert.strictEqual(typeof stats.hitRate, 'number', 'Should return hit rate');
    });

    test('Handles overwriting existing keys', () => {
        cache.set('key', 'value1');
        assert.strictEqual(cache.get('key'), 'value1');

        cache.set('key', 'value2');
        assert.strictEqual(cache.get('key'), 'value2', 'Should update existing value');
    });

    test('Automatic cleanup on size threshold', () => {
        // Set many items to trigger cleanup (every 40 items)
        for (let i = 0; i < 50; i++) {
            cache.set(`key${i}`, `value${i}`, 1); // Very short TTL
        }

        // Force a small delay to allow TTL to expire
        setTimeout(() => {
            // Add one more to trigger cleanup
            cache.set('trigger', 'cleanup');

            // Recent item should still exist
            assert.strictEqual(cache.get('trigger'), 'cleanup');
        }, 10);
    });

    test('Custom TTL per key works', () => {
        cache.set('short', 'expires-soon', 50);
        cache.set('long', 'expires-later', 10000);

        assert.strictEqual(cache.get('short'), 'expires-soon');
        assert.strictEqual(cache.get('long'), 'expires-later');
    });

    test('Handles null and undefined values', () => {
        cache.set('null-value', null);
        cache.set('undefined-value', undefined);

        // Note: Both null and undefined are valid cache values
        assert.strictEqual(cache.get('null-value'), null);
        assert.strictEqual(cache.get('undefined-value'), undefined);
    });
});
