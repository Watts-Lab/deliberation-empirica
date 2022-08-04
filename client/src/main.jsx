import { EmpiricaGlobal } from '@empirica/player';
import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import App, { getURL } from './App';
import './index.css';
import { Button } from './components/Button';

Sentry.init({
  dsn: 'https://bbe62f66328d40c6bf9008b293e44d7d@o1288526.ingest.sentry.io/6505477',
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
  enabled: process.env.NODE_ENV !== 'development',
});

ReactDOM.render(
  <>
    <Button
      className="ml-2 mb-3"
      type="submit"
      style={{
        position: 'absolute',
        zIndex: 100,
        right: 5,
        top: 5,
      }}
      handleClick={() => {
        Sentry.showReportDialog({
          eventId: Sentry.captureEvent({
            message: 'User Feedback',
            stacktrace: [
              Sentry.captureMessage,
            ],
          }),
          subtitle: 'Please let us know what went wrong below.',
          subtitle2: '',
          labelName: 'MTurk ID',
          labelEmail: 'Sorry, our page is still under construction! Please ignore this field for now.',
          labelComments: 'Please describe what happened',
          labelSubmit: 'Submit',
          user: {
            name: ' ',
            email: 'IgnoreThisField@example.com',
          },
        });
      }}
    >
      Report feedback
    </Button>

    <EmpiricaGlobal url={getURL()}>
      <App />
    </EmpiricaGlobal>
  </>,
  document.getElementById('root'),
);
