import { EmpiricaGlobal } from "@empirica/player";
import React from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import App, { getURL } from "./App";
import "./index.css";
import { Button } from "./components/Button";






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
  tracesSampleRate: 1.0,
  //enabled: process.env.NODE_ENV !== 'development'
});





ReactDOM.render(
   
    <React.StrictMode>
        <Button
          className="ml-2 mb-3" 
          type="submit" 
          style={{
            position: 'absolute',
            right: 5,
            top: 5,
          }}
          base='inline-flex items-center px-4 py-2 mt-6 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500'
          handleClick={() => {
            Sentry.showReportDialog({
              eventId: Sentry.captureEvent({
                message: 'User Feedback',
                stacktrace: [
                  Sentry.captureMessage
                ],
              }),
              subtitle: "Please let us know what went wrong below.",
              subtitle2: '',
              labelName: "MTurk ID",
              labelEmail: "What stage in the experiment were you in?",
              labelComments: 'Please describe what happened'
            })}
          }
        >
            Report feedback
        </Button>
        
      <EmpiricaGlobal url={getURL()}>
        <App />
      </EmpiricaGlobal>
    </React.StrictMode>,
    document.getElementById("root")
  
);
