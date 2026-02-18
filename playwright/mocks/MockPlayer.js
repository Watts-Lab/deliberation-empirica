import { MockStage } from './MockStage.js';

/**
 * ============================================================================
 * MockPlayer - Mutable State Container with React Reactivity
 * ============================================================================
 *
 * This class simulates Empirica's player object and is the core of the mock
 * state management system. It uses an "observable mutation" pattern where:
 *
 * 1. State is stored in a mutable `_attributes` object (not React state!)
 * 2. Mutations happen via set()/append() methods (like real Empirica)
 * 3. After each mutation, an onChange callback is called
 * 4. The callback triggers React re-renders, propagating the new state
 *
 * ## Why Not Use React State?
 *
 * Real Empirica uses a global state store that components read from via hooks.
 * To accurately simulate this, we need:
 * - Direct mutations (player.set('key', 'value'))
 * - Shared state visible across multiple components
 * - State that persists across React re-renders
 *
 * React's useState creates LOCAL state that can only be updated via setters.
 * Instead, we use plain JavaScript objects that can be mutated directly, then
 * trigger React re-renders via the _onChange callback.
 *
 * ## The Reactivity Pattern:
 *
 * ```
 * Component: player.set('dailyId', '123')
 *            ↓
 * MockPlayer: this._attributes['dailyId'] = '123'
 *            ↓
 * MockPlayer: this._onChange()  // → MockEmpiricaProvider.handleChange()
 *            ↓
 * Provider:  forceUpdate(n => n + 1)  // Increment renderCount
 *            ↓
 * Provider:  contextValue = useMemo(..., [renderCount, ...])  // New object!
 *            ↓
 * React:     Context value changed, re-render consumers
 *            ↓
 * Component: const player = usePlayer()  // Same instance!
 *            ↓
 * Component: const id = player.get('dailyId')  // Returns '123'
 * ```
 *
 * ## Key Design Principles:
 *
 * 1. **Stable Instance**: The MockPlayer instance MUST remain stable across
 *    re-renders (same object reference). If it changed, all mutations would
 *    be lost. MockEmpiricaProvider's useMemo ensures this.
 *
 * 2. **Mutable State**: The _attributes object is mutated directly. This is
 *    intentional! React doesn't track changes to plain objects, so we use
 *    _onChange to manually trigger re-renders.
 *
 * 3. **Synchronous Updates**: When set() is called, _attributes is updated
 *    immediately (synchronous). The _onChange callback is also called
 *    synchronously, but React batches the resulting state updates.
 *
 * 4. **Test Instrumentation**: _setCalls and _appendCalls track all mutations
 *    for test assertions, allowing tests to verify that state changes happened.
 *
 * @see MockEmpiricaProvider.jsx - Shows how _onChange triggers re-renders
 * @see empirica-hooks.js - Shows how usePlayer() returns this instance
 */
export class MockPlayer {
  /**
   * Create a new MockPlayer instance
   *
   * @param {string} id - Unique player identifier
   * @param {Object} initialAttributes - Initial player state
   * @param {Function} onChange - Callback to trigger React re-renders
   *                               (typically MockEmpiricaProvider.handleChange)
   */
  constructor(id, initialAttributes = {}, onChange = null) {
    // =======================================================================
    // Public Properties
    // =======================================================================
    this.id = id;  // Immutable player identifier

    // =======================================================================
    // State Storage - Mutable Object
    // =======================================================================
    // This is where player state lives. It's a plain JavaScript object, not
    // React state! We mutate it directly in set()/append(), then trigger
    // React re-renders via _onChange.
    //
    // Why a plain object?
    // - Matches real Empirica's architecture (global store, not React state)
    // - Allows direct mutations (player.set() syntax)
    // - Survives React re-renders (not re-created like React state)
    // - Can be shared/inspected outside React (window.mockEmpiricaContext)
    this._attributes = { ...initialAttributes };

    // =======================================================================
    // Test Instrumentation
    // =======================================================================
    // Track all set() and append() calls for test assertions. Tests can
    // verify state changes by checking player.getAllSetCalls().
    this._setCalls = [];
    this._appendCalls = [];

    // =======================================================================
    // Reactivity Callback
    // =======================================================================
    // This function is called after every mutation (set/append). It typically
    // points to MockEmpiricaProvider.handleChange, which increments renderCount
    // and triggers a re-render cascade.
    //
    // Can be null initially (for old API), in which case MockEmpiricaProvider's
    // useLayoutEffect will inject it before child components mount.
    this._onChange = onChange;

    // =======================================================================
    // Nested Per-Player Stage Object
    // =======================================================================
    // Empirica has TWO stage concepts:
    // 1. Shared stage: stage.get('discussion') - same for all players
    // 2. Per-player stage: player.stage.set('vote') - unique per player
    //
    // This is the per-player stage. It's a separate MockStage instance nested
    // inside each player, allowing player-specific stage data like:
    //   player.stage.set('hasVoted', true)
    //   player.stage.get('hasVoted')  // Only this player's vote status
    //
    // We pass the same onChange callback so mutations trigger re-renders.
    this.stage = new MockStage(onChange);
  }

  // =========================================================================
  // State Access Methods
  // =========================================================================

  /**
   * Get a player attribute value
   *
   * This is the READ half of the reactivity system. Components call this after
   * re-rendering to get fresh data from the (potentially mutated) _attributes.
   *
   * Flow:
   * 1. Component re-renders (triggered by set() → _onChange → forceUpdate)
   * 2. Component calls player.get('key')
   * 3. Method reads from _attributes (which was mutated by set())
   * 4. Component sees the new value!
   *
   * @param {string} key - Attribute name
   * @returns {*} Attribute value, or null if not set
   */
  get(key) {
    return this._attributes[key] ?? null;
  }

  /**
   * Set a player attribute value
   *
   * This is the WRITE half of the reactivity system. It:
   * 1. Mutates _attributes directly (synchronous)
   * 2. Records the change for test assertions
   * 3. Calls _onChange to trigger React re-renders
   *
   * The _onChange callback eventually causes components to re-render and call
   * get() again, seeing the new value.
   *
   * ## Reactivity Flow:
   * ```
   * set('dailyId', '123')
   *   → this._attributes['dailyId'] = '123'  // Mutate!
   *   → this._onChange()  // Tell React to re-render
   *     → MockEmpiricaProvider.handleChange()
   *       → forceUpdate(n => n + 1)
   *         → renderCount: 0 → 1
   *           → contextValue = new object (renderCount in deps)
   *             → React Context propagates
   *               → All usePlayer() consumers re-render
   *                 → They call get('dailyId')
   *                   → Returns '123' from mutated _attributes
   * ```
   *
   * ## Why This Works:
   * The MockPlayer instance is stable (same reference across re-renders due to
   * useMemo in Provider). So when components re-render and call get(), they're
   * reading from the SAME _attributes object, but it's been mutated since the
   * last render. This is intentional - we're using object mutation + manual
   * re-render triggers instead of React's immutable state updates.
   *
   * @param {string} key - Attribute name
   * @param {*} value - New value to set
   */
  set(key, value) {
    console.log(`[MockPlayer ${this.id}] set("${key}"), _onChange=${!!this._onChange}`);

    // Step 1: Mutate the internal state (synchronous, immediate)
    this._attributes[key] = value;

    // Step 2: Record for test assertions (verify state changes happened)
    this._setCalls.push({ key, value, timestamp: Date.now() });

    // Step 3: Trigger React re-renders so components see the new value
    if (this._onChange) {
      console.log(`[MockPlayer ${this.id}] Calling _onChange to trigger re-render`);
      this._onChange();  // → MockEmpiricaProvider.handleChange() → forceUpdate()
    } else {
      // This should never happen in practice (useLayoutEffect injects it),
      // but warn loudly if it does so we can debug reactivity issues.
      console.warn(`[MockPlayer ${this.id}] WARNING: _onChange is not set!`);
    }
  }

  /**
   * Append a value to an array attribute
   *
   * If the attribute doesn't exist, creates it as an empty array first.
   * Then pushes the value and triggers re-render (same as set()).
   *
   * Example:
   *   player.append('messages', { text: 'Hello', time: Date.now() })
   *   player.get('messages')  // [{ text: 'Hello', time: ... }]
   *
   * @param {string} key - Attribute name
   * @param {*} value - Value to append to array
   */
  append(key, value) {
    // Ensure attribute exists as an array
    if (!this._attributes[key]) {
      this._attributes[key] = [];
    }

    // Mutate array (same pattern as set())
    this._attributes[key].push(value);

    // Record for test assertions
    this._appendCalls.push({ key, value, timestamp: Date.now() });

    // Trigger React re-renders
    if (this._onChange) {
      this._onChange();
    }
  }

  // =========================================================================
  // Test Instrumentation & Debugging Methods
  // =========================================================================
  // These methods help tests verify that state changes happened correctly.
  // They're not part of the reactivity system, just convenient test helpers.

  /**
   * Get all set() calls for a specific key
   *
   * Useful for verifying that a specific attribute was updated:
   *   expect(player.getSetCalls('dailyId')).toHaveLength(1)
   *   expect(player.getSetCalls('dailyId')[0].value).toBe('123')
   *
   * @param {string} key - Attribute name
   * @returns {Array} Array of {key, value, timestamp} objects
   */
  getSetCalls(key) {
    return this._setCalls.filter(call => call.key === key);
  }

  /**
   * Get all append() calls for a specific key
   *
   * @param {string} key - Attribute name
   * @returns {Array} Array of {key, value, timestamp} objects
   */
  getAppendCalls(key) {
    return this._appendCalls.filter(call => call.key === key);
  }

  /**
   * Get all set() calls (any key)
   *
   * Returns a shallow copy to prevent test code from accidentally mutating
   * the internal tracking arrays.
   *
   * @returns {Array} Array of {key, value, timestamp} objects
   */
  getAllSetCalls() {
    return [...this._setCalls];
  }

  /**
   * Get all append() calls (any key)
   *
   * @returns {Array} Array of {key, value, timestamp} objects
   */
  getAllAppendCalls() {
    return [...this._appendCalls];
  }

  /**
   * Clear all call tracking
   *
   * Useful for test isolation when reusing the same player instance across
   * multiple test assertions:
   *   player.resetTracking()
   *   // ... trigger some action ...
   *   expect(player.getAllSetCalls()).toHaveLength(2)  // Only new calls
   */
  resetTracking() {
    this._setCalls = [];
    this._appendCalls = [];
  }

  /**
   * Get a complete snapshot of internal state for debugging
   *
   * Returns copies of all internal data structures. Useful for:
   * 1. Debugging reactivity issues (check hasOnChange)
   * 2. Inspecting state in tests (attributes, setCalls)
   * 3. Comparing player state across re-renders
   *
   * Example test usage:
   *   const before = player.debugDump()
   *   player.set('key', 'value')
   *   const after = player.debugDump()
   *   expect(after.setCalls.length).toBeGreaterThan(before.setCalls.length)
   *
   * @returns {Object} Complete state snapshot
   */
  debugDump() {
    return {
      id: this.id,
      attributes: { ...this._attributes },           // Copy of all state
      setCalls: [...this._setCalls],                 // Copy of set() history
      appendCalls: [...this._appendCalls],           // Copy of append() history
      hasOnChange: !!this._onChange,                 // Is reactivity hooked up?
      stageAttributes: this.stage ? { ...this.stage._attributes } : null,  // Nested stage state
    };
  }
}
