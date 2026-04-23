import React, { useState } from "react";
import { isMobile } from "react-device-detect";
import { detect } from "detect-browser";
import { Button } from "stagebook/components";
import { Alert } from "./Alert";

// Conditional wrappers specific to deliberation-empirica. Stagebook now
// ships TimeConditionalRender / PositionConditionalRender /
// ConditionsConditionalRender / SubmissionConditionalRender as part of
// its Stage rendering; the wrappers here cover platform-only concerns
// (dev test controls, browser compatibility).

// If test controls are enabled, renders a button to toggle the content
// on or off (initially off). Otherwise displays the content by default.
export function DevConditionalRender({ children }) {
  const [contentEnabled, setContentEnabled] = useState(
    !(process.env.TEST_CONTROLS === "enabled")
  );
  return (
    <>
      {contentEnabled && children}
      {process.env.TEST_CONTROLS === "enabled" && !contentEnabled && (
        <Button
          onClick={() => setContentEnabled(!contentEnabled)}
          data-testid="enableContentButton"
        >
          Show Content
        </Button>
      )}
    </>
  );
}

// Blocks the study from rendering on unsupported browsers / mobile devices.
export function BrowserConditionalRender({ children }) {
  if (isMobile) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Mobile Device Detected">
          Mobile devices are not supported. Please join again from a computer to
          participate.
        </Alert>
      </div>
    );
  }

  const browser = detect();
  const majorVersion = browser?.version.split(".")[0];
  const browserIsSupported =
    majorVersion >= 89 || // chrome, firefox, edge
    (majorVersion >= 75 && browser?.name === "opera") ||
    (majorVersion >= 15 && browser?.name === "safari");

  if (!browserIsSupported) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Browser Version Detected">
          Your browser is not supported. Please visit the study link with a more
          up-to-date browser.
        </Alert>

        <h3>List of Supported Browsers:</h3>
        <ul>
          <li>Chrome {">"}= 89 </li>
          <li>Edge {">"}= 89 </li>
          <li>Firefox {">"}= 89 </li>
          <li>Opera {">"}= 75 </li>
          <li>Safari {">"}= 15 </li>
        </ul>
      </div>
    );
  }

  return children;
}
