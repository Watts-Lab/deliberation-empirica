/**
 * Mock Empirica Stage for component tests
 */
export class MockStage {
  constructor(initialAttributes = {}) {
    this._attributes = { ...initialAttributes };
  }

  get(key) {
    return this._attributes[key] ?? null;
  }

  set(key, value) {
    this._attributes[key] = value;
  }
}
