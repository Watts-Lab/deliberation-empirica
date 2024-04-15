import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Button } from "./components/Button";
import "./index.css";
import { BrowserConditionalRender } from "./components/Layouts";

Sentry.init({
  dsn: "https://bbe62f66328d40c6bf9008b293e44d7d@o1288526.ingest.sentry.io/6505477",
  integrations: [new BrowserTracing()],
  // beforeSend(event, hint) {
  //   Sentry.showReportDialog({
  //     eventId: event.event_id
  //   });
  // },
  attachStacktrace: true,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});

// Todo: can we move this button to a separate file?

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <>
    <Button
      className="m-2 absolute z-100 right-0 top-0 rounded-md"
      type="submit"
      handleClick={() => {
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
        }}
        fallback="An error has occurred. Try refreshing the page. If the problem persists, please contact the researchers."
        showDialog
      >
        <App />
      </Sentry.ErrorBoundary>
    </BrowserConditionalRender>
  </>
);
