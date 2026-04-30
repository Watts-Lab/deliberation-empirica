/**
 * Mock Empirica Game for component tests
 * Tracks state changes like the real game object
 *
 * Supports reactivity: Pass an onChange callback to trigger React re-renders
 * when game attributes change (via set/append).
 *
 * The optional `id` is a JS property (not part of `_attributes`), mirroring
 * the real Empirica game object — components such as SharedNotepad read
 * `game.id` directly, not via `game.get()`.
 */
export class MockGame {
  constructor(initialAttributes = {}, onChange = null, id = null) {
    // Support both (attrs, onChange) and (onChange) signatures
    if (typeof initialAttributes === "function") {
      this._onChange = initialAttributes;
      this._attributes = {};
    } else {
      this._attributes = { ...initialAttributes };
      this._onChange = onChange;
    }
    this.id = id;
    this._setCalls = [];
    this._appendCalls = [];
  }

  get(key) {
    return this._attributes[key] ?? null;
  }

  set(key, value) {
    this._attributes[key] = value;
    this._setCalls.push({ key, value, timestamp: Date.now() });

    // Notify provider of change to trigger re-render
    if (this._onChange) {
      this._onChange();
    }
  }

  append(key, value) {
    if (!this._attributes[key]) {
      this._attributes[key] = [];
    }
    this._attributes[key].push(value);
    this._appendCalls.push({ key, value, timestamp: Date.now() });

    // Notify provider of change to trigger re-render
    if (this._onChange) {
      this._onChange();
    }
  }

  // Test assertion helpers
  getSetCalls(key) {
    return this._setCalls.filter((call) => call.key === key);
  }

  getAppendCalls(key) {
    return this._appendCalls.filter((call) => call.key === key);
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
