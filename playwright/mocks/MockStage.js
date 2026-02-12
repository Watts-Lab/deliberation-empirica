/**
 * Mock Empirica Stage for component tests
 * Tracks state changes like the real stage object
 *
 * Used both as the shared stage (via useStage()) and as
 * the per-player stage (via player.stage).
 */
export class MockStage {
  constructor(initialAttributes = {}) {
    this._attributes = { ...initialAttributes };
    this._setCalls = [];
    this._appendCalls = [];
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
