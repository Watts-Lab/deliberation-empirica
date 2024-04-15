# Recorded metadata

We record metadata from several sources

### url Params

Arbitrary url parameters can be appended to the URL using the format:

```
http://study.deliberation-lab.org/?param1=val1&param2=val2&param3=val3
```

There are several exceptions, which are used by mturk, prolific, or in debugging. The following have special meaning:

- `playerKey`
- `workerId`
- `assignmentId`
- `hitId`
- `turkSubmitTo`
- `PROLIFIC_PID`
- `STUDY_ID`
- `SESSION_ID`

### Connection Info

We collect information about where the connection to deliberation lab is coming from, including:

- `country` - the two-letter ([ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1#Codes)) country code of the inbound IP address
- `timezone` - The ID of the time zone associated with location (e.g. America/Los_Angeles) of the inbound IP address
- `timezoneOffset` - The UTC offset of the timezone (e.g. -07:00) of the inbound IP address
- `isKnownVpn` - whether the inbound ip address comes from a [list of known vpns](https://github.com/X4BNet/lists_vpn)
- `isLikelyVpn` - having the browser timezone not match the ip timezone is sometimes a signal of vpn use
