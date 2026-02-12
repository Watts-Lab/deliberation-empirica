import React, { useEffect, useState } from 'react';
// Import REAL Daily packages
// Note: Integration tests use playwright.integration.config.mjs which has NO Daily alias
import { DailyProvider } from '@daily-co/daily-react';
import Daily from '@daily-co/daily-js';

/**
 * Test wrapper that creates a Daily call object in the browser context
 * and provides it to children via DailyProvider.
 *
 * This solves the problem that Daily.createCallObject() requires browser
 * globals (navigator, window) which aren't available in Playwright's
 * Node.js test runner context.
 */
export function DailyTestWrapper({ roomUrl, children, onCallCreated }) {
  const [callObject, setCallObject] = useState(null);

  useEffect(() => {
    // Create call object in browser context
    const call = Daily.createCallObject();

    // Expose on window for test access
    if (!window.testCallObjects) {
      window.testCallObjects = [];
    }
    window.testCallObjects.push(call);
    window.currentTestCall = call;

    setCallObject(call);

    // Notify test that call object is ready
    if (onCallCreated) {
      onCallCreated(call);
    }

    return () => {
      // Cleanup on unmount
      call.destroy().catch((e) => console.warn('Error destroying call:', e));
    };
  }, [onCallCreated]);

  // Auto-join if roomUrl provided
  useEffect(() => {
    if (callObject && roomUrl) {
      callObject
        .join({ url: roomUrl, userName: 'Test User' })
        .catch((e) => console.error('Error joining:', e));
    }
  }, [callObject, roomUrl]);

  if (!callObject) {
    return <div data-test="loading">Loading Daily...</div>;
  }

  return <DailyProvider callObject={callObject}>{children}</DailyProvider>;
}
