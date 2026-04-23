import React, { useEffect } from "react";
import * as Sentry from "@sentry/react";

/**
 * Minimal component that calls Sentry.setTag for each provided tag.
 * Used by ErrorReporting.ct.jsx to verify the Sentry mock captures setTag calls.
 */
export function SentryTagTestComponent({ tags = {} }) {
  useEffect(() => {
    Object.entries(tags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });
  }, [tags]);

  return <div data-testid="tagTestMounted">Tag test</div>;
}
