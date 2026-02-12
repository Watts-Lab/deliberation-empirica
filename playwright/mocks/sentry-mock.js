/**
 * Mock Sentry for component tests
 *
 * This module is aliased to replace '@sentry/react' in tests.
 * All functions are no-ops to prevent Sentry from interfering with tests.
 */

// Error capturing
export function captureMessage() {}
export function captureException() {}
export function captureEvent() {}

// Breadcrumbs
export function addBreadcrumb() {}

// Context setters
export function setUser() {}
export function setTag() {}
export function setTags() {}
export function setExtra() {}
export function setExtras() {}
export function setContext() {}

// Scope management
export function withScope(callback) {
  callback({
    setUser: () => {},
    setTag: () => {},
    setTags: () => {},
    setExtra: () => {},
    setExtras: () => {},
    setContext: () => {},
    setLevel: () => {},
    setFingerprint: () => {},
    addBreadcrumb: () => {},
    clear: () => {},
  });
}

export function configureScope(callback) {
  callback({
    setUser: () => {},
    setTag: () => {},
    setTags: () => {},
    setExtra: () => {},
    setExtras: () => {},
    setContext: () => {},
    setLevel: () => {},
    setFingerprint: () => {},
    addBreadcrumb: () => {},
    clear: () => {},
  });
}

// Transaction/Span
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

// React-specific
export function ErrorBoundary({ children, fallback }) {
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
  ErrorBoundary,
  withProfiler,
  withErrorBoundary,
};

export default Sentry;
