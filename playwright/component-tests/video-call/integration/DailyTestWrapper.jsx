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
 *
 * @param {string} roomUrl - Daily room URL (for auto-join if autoJoin=true)
 * @param {boolean} autoJoin - Whether to auto-join the room (default: true)
 *                             Set to false when wrapping VideoCall (which handles its own join)
 * @param {Function} onCallCreated - Callback when call object is created
 * @param {React.ReactNode} children - Child components
 */
export function DailyTestWrapper({ roomUrl, autoJoin = true, children, onCallCreated }) {
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

  // Auto-join if roomUrl provided and autoJoin is true
  useEffect(() => {
    if (callObject && roomUrl && autoJoin) {
      callObject
        .join({
          url: roomUrl,
          userName: 'Test User',
          // Start with camera and mic enabled
          startVideoOff: false,
          startAudioOff: false,
        })
        .catch((e) => console.error('Error joining:', e));
    }
  }, [callObject, roomUrl, autoJoin]);

  if (!callObject) {
    return <div data-test="loading">Loading Daily...</div>;
  }

  return <DailyProvider callObject={callObject}>{children}</DailyProvider>;
}
