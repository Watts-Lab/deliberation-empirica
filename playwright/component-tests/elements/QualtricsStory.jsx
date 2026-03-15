/**
 * Test story for Qualtrics component tests.
 *
 * NOTE: This "story file" pattern is NOT the preferred approach for most
 * component tests in this project. Most tests (see video-call/mocked/) mount
 * an imported component directly — no wrapper file needed. Prefer that.
 *
 * We use a story here for one specific reason: QURL-006 needs its onSubmit
 * callback to run in the **browser** context so it can write to window. In
 * Playwright CT, function props defined inline in a test file run in the
 * Node.js test runner, not the browser — so window there is not the browser
 * window. Defining handleSubmit here (compiled by Vite, runs in browser)
 * lets window.__qualtricsSubmitted be visible to page.waitForFunction().
 *
 * IdleProvider is included for cleanliness (avoids a console.error from the
 * default IdleContext no-op), but is not the reason a story is required.
 */
import React from 'react';
import { Qualtrics } from '../../../client/src/elements/Qualtrics';
import { IdleProvider } from '../../../client/src/components/IdleProvider';

export function QualtricsStory({ url, urlParams }) {
  const handleSubmit = () => {
    window.__qualtricsSubmitted = true;
  };
  return (
    <IdleProvider>
      <Qualtrics url={url} urlParams={urlParams} onSubmit={handleSubmit} />
    </IdleProvider>
  );
}
