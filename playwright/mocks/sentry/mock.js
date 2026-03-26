/**
 * Mock Sentry for component tests
 *
 * This module is aliased to replace '@sentry/react' in tests.
 *
 * ## Capture Store
 *
 * All Sentry calls are recorded in window.mockSentryCaptures, accessible via:
 *
 *   const captures = await page.evaluate(() => window.mockSentryCaptures);
 *   expect(captures.messages[0].message).toBe('reportedAVError');
 *   expect(captures.breadcrumbs[0].category).toBe('av-recovery');
 *
 * ## Reset Between Tests
 *
 *   await page.evaluate(() => window.mockSentryCaptures.reset());
 *
 * ## Structure
 *
 *   window.mockSentryCaptures = {
 *     messages: [{ message, hint, timestamp }],
 *     exceptions: [{ error, hint, timestamp }],
 *     breadcrumbs: [{ category, message, level, data, timestamp }],
 *     events: [{ event, hint, timestamp }],
 *     tags: { key: value, ... },
 *     reset() { ... }
 *   }
 */

function initCaptures() {
  const store = {
    messages: [],
    exceptions: [],
    breadcrumbs: [],
    events: [],
    tags: {},
    reset() {
      this.messages = [];
      this.exceptions = [];
      this.breadcrumbs = [];
      this.events = [];
      this.tags = {};
    },
  };
  if (typeof window !== 'undefined') {
    window.mockSentryCaptures = store;
  }
  return store;
}

const captures = initCaptures();

// Error capturing
export function captureMessage(message, hint) {
  captures.messages.push({ message, hint, timestamp: Date.now() });
}

export function captureException(error, hint) {
  captures.exceptions.push({
    error: error?.message || String(error),
    hint,
    timestamp: Date.now(),
  });
}

export function captureEvent(event, hint) {
  captures.events.push({ event, hint, timestamp: Date.now() });
}

// Breadcrumbs
export function addBreadcrumb(breadcrumb) {
  captures.breadcrumbs.push({ ...breadcrumb, timestamp: Date.now() });
}

// Context setters
export function setUser() {}
export function setTag(key, value) {
  captures.tags[key] = value;
}
export function setTags(tags) {
  Object.assign(captures.tags, tags);
}
export function setExtra() {}
export function setExtras() {}
export function setContext() {}

// Scope management - pass a mock scope that also forwards breadcrumbs to capture store
const mockScope = {
  setUser: () => {},
  setTag: (key, value) => { captures.tags[key] = value; },
  setTags: (tags) => { Object.assign(captures.tags, tags); },
  setExtra: () => {},
  setExtras: () => {},
  setContext: () => {},
  setLevel: () => {},
  setFingerprint: () => {},
  addBreadcrumb: (b) => addBreadcrumb(b),
  clear: () => {},
};

export function withScope(callback) {
  callback(mockScope);
}

export function configureScope(callback) {
  callback(mockScope);
}

// Transaction/Span (no-op)
export function startTransaction() {
  return {
    finish: () => {},
    setTag: () => {},
    setData: () => {},
    startChild: () => ({
      finish: () => {},
      setTag: () => {},
      setData: () => {},
    }),
  };
}

// Initialization
export function init() {}
export function close() {
  return Promise.resolve();
}
export function flush() {
  return Promise.resolve();
}

// React-specific
export function ErrorBoundary({ children }) {
  return children;
}

export function withProfiler(Component) {
  return Component;
}

export function withErrorBoundary(Component) {
  return Component;
}

// Default export for * as Sentry import pattern
const Sentry = {
  captureMessage,
  captureException,
  captureEvent,
  addBreadcrumb,
  setUser,
  setTag,
  setTags,
  setExtra,
  setExtras,
  setContext,
  withScope,
  configureScope,
  startTransaction,
  init,
  close,
  flush,
  ErrorBoundary,
  withProfiler,
  withErrorBoundary,
};

export default Sentry;
