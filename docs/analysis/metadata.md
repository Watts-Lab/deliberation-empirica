# Recorded metadata

The experiment records metadata from several sources:

### url Params

Arbitrary url parameters can be appended to the URL using the format:

```
http://study.deliberation-lab.org/?param1=val1&param2=val2&param3=val3
```

There are several exceptions, which are used by mturk, prolific, or in debugging. The following have special meaning:

- `playerKey` - used by our system to allow "virtual" players for use in debugging.
- `workerId` - MTurk ID
- `assignmentId` - MTurk HIT\*worker combination
- `hitId` - MTurk HIT
- `turkSubmitTo` - MTurk completion URL
- `PROLIFIC_PID` - Prolific participant ID
- `STUDY_ID` - Prolific study ID
- `SESSION_ID` - Prolific participant \* study combination

### BrowserInfo

- `width` - the amount of horizontal space available in the browser window (in pixels)
- `height` - the amount of vertical space available in the browser window (in pixels)
- `screenWidth` - the width of the user's monitor display (in pixels)
- `screenHeight` - the height of the user's monitor display (in pixels)
- `userAgent` - information about which browser is being used
- `language` - the preferred language of the user as set in the browser UI
- `timezone` - the timezone setting of the user's operating system
- `referrer` - the page that linked to the study (e.g. https:)

### Connection Info

- `country` - the two-letter ([ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1#Codes)) country code of the inbound IP address
- `timezone` - The ID of the time zone associated with location (e.g. America/Los_Angeles) of the inbound IP address
- `timezoneOffset` - The UTC offset of the timezone (e.g. -07:00) of the inbound IP address
- `isKnownVpn` - whether the inbound ip address comes from a [list of known vpns](https://github.com/X4BNet/lists_vpn)
- `isLikelyVpn` - having the browser timezone not match the ip timezone is sometimes a signal of vpn use

### Tracked Links

Each tracked link element saves a record under `trackedLink_<name>`. In the science export these are collected inside the `trackedLinks` object alongside surveys/prompts. Every record contains:

- `url`, `displayText`, and `name` — the static definition of the link.
- `events` — ordered list of `{ type, timestamp, stage, stageTimeSeconds, timeAwaySeconds? }`.
- `totalTimeAwaySeconds` and `lastTimeAwaySeconds` — summaries of focus gaps attributed to the link.

Use these to confirm that participants followed required external links and how long they were away from the Deliberation Lab tab.
