describe("Returning Player", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();
  });

  it("throws error when videoStorageLocation is invalid", () => {
    const configJson = `{
      "batchName": "cytest_08_Invalid_Config_VideoStorageLocation",
      "cdn": "test",
      "treatmentFile": "projects/example/cypress.treatments.yaml",
      "customIdInstructions": "none",
      "platformConsent": "US",
      "consentAddendum": "none",
      "checkAudio": true,
      "checkVideo": true,
      "introSequence": "none",
      "treatments": [
        "cypress1_simple"
      ],
      "payoffs": "equal",
      "knockdowns": "none",
      "dispatchWait": 1,
      "launchDate": "immediate",
      "centralPrereg": false,
      "preregRepos": [],
      "dataRepos": [
        {
          "owner": "Watts-Lab",
          "repo": "deliberation-data-test",
          "branch": "main",
          "directory": "cypress_test_exports"
        }
      ],
      "videoStorage": {
        "bucket": "nonExistentBucket",
        "region": "us-east-1"
      },
      "exitCodes": "none"
    }`;

    cy.empiricaCreateCustomBatch(configJson, { skipReadyCheck: true });
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.contains(
      `[data-test=batchLine]`,
      "cytest_08_Invalid_Config_VideoStorageLocation"
    ).contains("Failed");
  });

  // it.skip("throws error when video storage region is invalid", () => {
  //   const configJson = `{
  //     "batchName": "cytest_08_Invalid_Config_Video_Storage_Region",
  //     "cdn": "test",
  //     "treatmentFile": "projects/example/cypress.treatments.yaml",
  //     "customIdInstructions": "none",
  //     "platformConsent": "US",
  //     "consentAddendum": "none",
  //     "checkAudio": false,
  //     "checkVideo": false,
  //     "introSequence": "none",
  //     "treatments": [
  //       "cypress1_simple"
  //     ],
  //     "payoffs": "equal",
  //     "knockdowns": "none",
  //     "dispatchWait": 1,
  //     "launchDate": "immediate",
  //     "centralPrereg": false,
  //     "preregRepos": [],
  //     "dataRepos": [
  //       {
  //         "owner": "Watts-Lab",
  //         "repo": "deliberation-data-test",
  //         "branch": "main",
  //         "directory": "cypress_test_exports"
  //       }
  //     ],
  //     "videoStorage": {
  //       "bucket": "deliberation-lab-recordings-test-us-west-1",
  //       "region": "us-east-1"
  //     },
  //     "exitCodes": "none"
  //   }`;

  //   cy.empiricaCreateCustomBatch(configJson, { skipReadyCheck: true });
  //   cy.wait(3000); // wait for batch creation callbacks to complete

  //   cy.contains(
  //     `[data-test=batchLine]`,
  //     "cytest_08_Invalid_Config_Video_Storage_Region"
  //   ).contains("Failed");
  // });

  it("throws error when github repo is invalid", () => {
    const configJson = `{
      "batchName": "cytest_08_Invalid_Config_NoGithubRepo",
      "cdn": "test",
      "treatmentFile": "projects/example/cypress.treatments.yaml",
      "customIdInstructions": "none",
      "platformConsent": "US",
      "consentAddendum": "none",
      "checkAudio": false,
      "checkVideo": false,
      "introSequence": "none",
      "treatments": [
        "cypress1_simple"
      ],
      "payoffs": "equal",
      "knockdowns": "none",
      "dispatchWait": 1,
      "launchDate": "immediate",
      "centralPrereg": false,
      "preregRepos": [],
      "dataRepos": [
        {
          "owner": "Watts-Lab",
          "repo": "deliberation-data-test",
          "branch": "dummy_nonexistent",
          "directory": "cypress_test_exports"
        }
      ],
      "videoStorage": "none",
      "exitCodes": "none"
    }`;

    cy.empiricaCreateCustomBatch(configJson, { skipReadyCheck: true });
    cy.wait(5000); // wait for batch creation callbacks to complete

    cy.contains(
      `[data-test=batchLine]`,
      "cytest_08_Invalid_Config_NoGithubRepo"
    ).contains("Failed", { timeout: 10000 });
  });
});
