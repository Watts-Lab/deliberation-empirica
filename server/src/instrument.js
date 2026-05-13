// Sentry initialization. Imported as the first line of index.js so it
// runs before any other module's evaluation — including transitive
// throws inside `import "./callbacks"` and friends. ES module imports
// are hoisted in order; the very first `import "./instrument.js"`
// guarantees Sentry is initialized before anything below it loads.
//
// Lives in its own file (rather than inline at the top of index.js)
// because ESM disallows code-before-imports in the same file: any
// `Sentry.init(...)` call colocated with the top of index.js would
// still run AFTER the file's imports finished evaluating, which is
// exactly the boot-time gap that issue #183 is closing.
//
// To rotate the DSN: change the literal here + cut a new runtime
// release. The split-project posture (runner-backend vs.
// runner-frontend) keeps server alerts isolated from the noisier
// client surface.

import * as Sentry from "@sentry/node";

if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: "https://10ad96e22825c84a32e00ba62a8fc64c@o4510466125135872.ingest.us.sentry.io/4511382811639808",
    tracesSampleRate: 0.1,
    attachStacktrace: true,
    environment: process.env.NODE_ENV,
    // Disable default PII collection (user IPs, headers, cookies).
    // Mirrors the client's posture; required for participant-facing
    // software. The runtime sees participant traffic via the Empirica
    // websocket layer, not direct HTTP requests, so the practical
    // impact is small — but the flag makes the intent explicit + is
    // a backstop if upstream ever attaches default request headers.
    sendDefaultPii: false,
  });
}
