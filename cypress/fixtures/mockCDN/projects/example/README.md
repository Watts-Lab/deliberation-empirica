# Example Study

This project holds example files used to demonstrate how to construct the various resources needed by the platform, and that are also used in the test suite.

To run a single-player demo, use a variation on the config:

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/treatments-test.yaml",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["demo1p"],
  "introSequence": "cypress_standard",
  "platformConsent": "US",
  "consentAddendum": "projects/example/consentAddendum.md",
  "launchDate": "01 Mar 2023 23:30:00 EST"
}
```

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 1,
  "treatments": ["demo1p"]
}
```

To run a 2-player demo:

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["video2p"]
}
```
