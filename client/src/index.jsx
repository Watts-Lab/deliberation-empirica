import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import React from "react";
import { createRoot } from "react-dom/client";
import { Button } from "stagebook/components";
import App from "./App";
import "./index.css";
import { BrowserConditionalRender } from "./components/ConditionalRender";
import { stripIpAddress } from "./utils/sentryBeforeSend";

// DSN baked into the bundle. Sentry client DSNs are public by design
// (anyone can inspect the bundle and read them); they identify an
// ingest endpoint with rate-limiting, not an auth credential. The
// `enabled` gate means dev builds don't ship events — only production
// builds (i.e. the runtime image) report. To rotate, change this
// literal and cut a new runtime release.
Sentry.init({
  dsn: "https://4aa47009f940e0c4c78f72f556c5fb72@o4510466125135872.ingest.us.sentry.io/4511382797484032",
  integrations: [new BrowserTracing()],
  beforeSend: stripIpAddress,
  attachStacktrace: true,
  release: process.env.BUNDLE_DATE,

  // Explicitly disable default PII collection (e.g. user IP, request
  // headers attached automatically). Belt + suspenders with
  // `beforeSend: stripIpAddress` — that hook removes IPs from any
  // synthesized `user.ip_address` field, and this flag prevents the
  // SDK from attaching them in the first place plus suppresses other
  // automatic PII surfaces (cookies, referer headers, etc.). Required
  // for participant-facing software; matches the privacy posture in
  // stripIpAddress.
  sendDefaultPii: false,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",

  // Increase depth for serializing nested objects in breadcrumbs and event extras.
  // Default is 3 levels, which was causing objects in AV diagnostic logs to appear
  // as [Object] instead of their actual data. Setting to 6 ensures we capture:
  // - Desired subscription state (2-3 levels: dailyId → {a, v})
  // - Status check arrays (4 levels: array → object → {desired/actual} → properties)
  // - Participant data (4 levels: participants → array → object → track properties)
  // See: https://docs.sentry.io/platforms/javascript/configuration/apis/
  normalizeDepth: 6,
});

// Todo: can we move this button to a separate file?

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <>
    <Button
      className="m-2 mt-1 absolute z-100 right-0 top-0 rounded-md"
      type="submit"
      onClick={() => {
        Sentry.showReportDialog({
          eventId: Sentry.captureEvent({
            message: "User Feedback",
            stacktrace: [Sentry.captureMessage],
          }),
          subtitle: "Please let us know what went wrong below.",
          subtitle2: "",
          labelName: "MTurk ID",
          labelEmail:
            "Sorry, our page is still under construction! Please ignore this field for now.",
          labelComments: "Please describe what happened",
          labelSubmit: "Submit",
          user: {
            name: " ",
            email: "IgnoreThisField@example.com",
          },
        });
      }}
    >
      Report Bugs
    </Button>

    <BrowserConditionalRender>
      <Sentry.ErrorBoundary
        beforeCapture={(scope) => {
          scope.setTag("location", "index.jsx");
          scope.setTag("batchName", window.dlBatchName || "unknown");
        }}
        fallback={({ error, componentStack, resetError }) => {
          if (
            error.message.includes("[Network] undefined") ||
            error.message.includes("connection error") ||
            componentStack.includes("TajribaParticipant.emit")
          ) {
            setTimeout(window.location.reload, 3000);

            return (
              <div>
                <h1>Connection Error Detected</h1>
                <p>Refreshing the page in 3 seconds</p>
              </div>
            );
          }

          const reset = () => {
            console.log("Resetting error boundary");
            resetError();
            window.location.reload();
          };

          return (
            <div>
              <h1>Something went wrong 🧐</h1>
              <p>
                If the problem persists, please contact the researchers with the
                following information:
              </p>
              <h2>Error details:</h2>
              <p>{error.toString()}</p>
              <p>{componentStack}</p>
              <br />
              <Button type="button" onClick={reset}>
                Try again
              </Button>
            </div>
          );
        }}
        showDialog={false}
      >
        <App />
      </Sentry.ErrorBoundary>
    </BrowserConditionalRender>
  </>,
);
