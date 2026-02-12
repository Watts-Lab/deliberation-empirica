import { MockStage } from './MockStage.js';

/**
 * Mock Empirica Player for component tests
 * Tracks state changes like the real player object
 *
 * Includes a nested `stage` property that simulates player.stage
 * (per-player stage data, different from the shared stage object).
 */
export class MockPlayer {
  constructor(id, initialAttributes = {}) {
    this.id = id;
    this._attributes = { ...initialAttributes };
    this._setCalls = [];
    this._appendCalls = [];

    // Nested stage for player.stage.set() / player.stage.append() usage
    // This is per-player stage data, different from the shared stage object
    this.stage = new MockStage();
  }

  get(key) {
    return this._attributes[key] ?? null;
  }

  set(key, value) {
    this._attributes[key] = value;
    this._setCalls.push({ key, value, timestamp: Date.now() });
  }

  append(key, value) {
    if (!this._attributes[key]) {
      this._attributes[key] = [];
    }
    this._attributes[key].push(value);
    this._appendCalls.push({ key, value, timestamp: Date.now() });
  }

  // Test assertion helpers
  getSetCalls(key) {
    return this._setCalls.filter(call => call.key === key);
  }

  getAppendCalls(key) {
    return this._appendCalls.filter(call => call.key === key);
  }

  getAllSetCalls() {
    return [...this._setCalls];
  }

  getAllAppendCalls() {
    return [...this._appendCalls];
  }

  // Reset tracking (for test isolation)
  resetTracking() {
    this._setCalls = [];
    this._appendCalls = [];
  }
}
