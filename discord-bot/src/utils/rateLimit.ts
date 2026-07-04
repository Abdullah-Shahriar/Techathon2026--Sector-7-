export class CooldownStore {
  private readonly hits = new Map<string, number>();

  constructor(private readonly cooldownMs: number) {}

  check(key: string): number {
    if (this.cooldownMs <= 0) return 0;
    const now = Date.now();
    const nextAllowed = this.hits.get(key) ?? 0;
    if (nextAllowed > now) {
      return Math.ceil((nextAllowed - now) / 1000);
    }
    this.hits.set(key, now + this.cooldownMs);
    return 0;
  }
}
