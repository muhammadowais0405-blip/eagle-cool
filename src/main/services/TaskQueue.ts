export type Task<T> = () => Promise<T>;

export class TaskQueue {
  private queue: Array<{ task: Task<any>; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  private running = 0;

  constructor(private maxConcurrent: number = 4) {}

  add<T>(task: Task<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.next();
    });
  }

  private async next() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;

    this.running++;
    const { task, resolve, reject } = this.queue.shift()!;

    try {
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running--;
      this.next();
    }
  }

  get pending() {
    return this.queue.length;
  }

  get active() {
    return this.running;
  }
}
