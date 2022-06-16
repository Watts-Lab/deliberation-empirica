import { EmpiricaGlobal } from "@empirica/player";
import React from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import App, { getURL } from "./App";
import "./index.css";


Sentry.init({
  dsn: "https://bbe62f66328d40c6bf9008b293e44d7d@o1288526.ingest.sentry.io/6505477",
  integrations: [new BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  enabled: process.env.NODE_ENV !== 'development',
});

ReactDOM.render(
  <React.StrictMode>
    <EmpiricaGlobal url={getURL()}>
      <App />
    </EmpiricaGlobal>
  </React.StrictMode>,
  document.getElementById("root")
);
