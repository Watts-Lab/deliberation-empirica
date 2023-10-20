# Example Study

This project holds example files used to demonstrate how to construct the various resources needed by the platform, and that are also used in the test suite.

To run a single-player demo, use a variation on the config:

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "preregister": "false",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["demo1p"],
  "introSequence": "cypress_intro",
  "platformConsent": "US",
  "consentAddendum": "projects/example/consentAddendum.md",
  "videoStorageLocation": "none",
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "demo"
    }
  ]
}
```

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "preregister": "false",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["video2p"],
  "consentAddendum": "projects/example/consentAddendum.md",
  "videoStorageLocation": "deliberation-lab-recordings-test",
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "demo"
    }
  ]
}
```

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "preregister": "false",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["video2p"],
  "videoStorageLocation": "deliberation-lab-recordings-test-us-west-1",
  "awsRegion": "us-west-1",
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "demo"
    }
  ]
}
```

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "preregister": "false",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["demo_list_sorter"],
  "consentAddendum": "projects/example/consentAddendum.md",
  "videoStorageLocation": "none",
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "demo"
    }
  ]
}
```

```json
{
  "batchName": "test_etherpad",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "preregister": "false",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["test_etherpad"],
  "checkAudio": false,
  "checkVideo": false,
  "videoStorageLocation": "none",
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "cypress_test_exports"
    }
  ]
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

```json
{
  "batchName": "test",
  "useData": "false",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 1,
  "treatments": ["cypress_textChat"],
  "cdn": "test",
  "videoStorageLocation": "deliberation-lab-recordings-test"
}
```

To run a 2-player demo:

```json
{
  "batchName": "labDemo",
  "preregister": false,
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 1,
  "cdn": "test",
  "treatments": ["video2p"]
}
```
