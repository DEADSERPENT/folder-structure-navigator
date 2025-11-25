/* ==================================================================
   PERFORMANCE MONITOR
   Singleton class for tracking operation performance metrics
   ================================================================== */

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics = new Map<string, number[]>();
    private readonly maxSamples = 100;

    private constructor() {}

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    recordOperation(name: string, durationMs: number): void {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        const arr = this.metrics.get(name)!;
        arr.push(durationMs);
        if (arr.length > this.maxSamples) {
            arr.splice(0, arr.length - this.maxSamples);
        }
    }

    getMetricsReport(): string {
        let txt = '# 📈 Performance metrics\n\n';
        for (const [op, values] of this.metrics.entries()) {
            const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
            const min = Math.min(...values);
            const max = Math.max(...values);
            txt += `## ${op}\n- Avg: ${avg} ms\n- Min: ${min} ms\n- Max: ${max} ms\n- Samples: ${values.length}\n\n`;
        }
        return txt;
    }

    clear(): void {
        this.metrics.clear();
    }
}
