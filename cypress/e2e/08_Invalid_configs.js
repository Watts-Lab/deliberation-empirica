describe("Returning Player", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();
  });

  it("throws error when videoStorageLocation is invalid", () => {
    const configJson = `{
                "batchName": "cytest_08_Invalid_Config_VideoStorageLocation",
                "treatmentFile": "projects/example/cypress.treatments.yaml",
                "dispatchWait": 1,
                "cdn": "test",
                "exitCodeStem": "cypress",
                "treatments": [
                  "cypress1_simple"
                ],
                "videoStorageLocation": "deliberation-lab-recordings-nonexistent-bucket",
                "dataRepos": [
                  {
                    "owner": "Watts-Lab",
                    "repo": "deliberation-data-test",
                    "branch": "main",
                    "directory": "cypress_test_exports"
                  }
                ]
              }`;

    cy.empiricaCreateCustomBatch(configJson, { skipReadyCheck: true });
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.contains(
      `[data-test=batchLine]`,
      "cytest_08_Invalid_Config_VideoStorageLocation"
    ).contains("Failed");
  });

  it.skip("throws error when video storage region is invalid", () => {
    const configJson = `{
                "batchName": "cytest_08_Invalid_Config_Video_Storage_Region",
                "treatmentFile": "projects/example/cypress.treatments.yaml",
                "dispatchWait": 1,
                "cdn": "test",
                "exitCodeStem": "cypress",
                "treatments": [
                  "cypress1_simple"
                ],
                "videoStorageLocation": "deliberation-lab-recordings-test-us-west-1",
                "dataRepos": [
                  {
                    "owner": "Watts-Lab",
                    "repo": "deliberation-data-test",
                    "branch": "main",
                    "directory": "cypress_test_exports"
                  }
                ]
              }`;

    cy.empiricaCreateCustomBatch(configJson, { skipReadyCheck: true });
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.contains(
      `[data-test=batchLine]`,
      "cytest_08_Invalid_Config_Video_Storage_Region"
    ).contains("Failed");
  });

  it("throws error when github repo is invalid", () => {
    const configJson = `{
                "batchName": "cytest_08_Invalid_Config_NoGithubRepo",
                "treatmentFile": "projects/example/cypress.treatments.yaml",
                "dispatchWait": 1,
                "cdn": "test",
                "exitCodeStem": "cypress",
                "treatments": [
                  "cypress1_simple"
                ],
                "videoStorageLocation": "deliberation-lab-recordings-nonexistent-bucket",
                "dataRepos": [
                  {
                    "owner": "Watts-Lab",
                    "repo": "deliberation-data-test",
                    "branch": "dummy_nonexistent",
                    "directory": "cypress_test_exports"
                  }
                ]
              }`;

    cy.empiricaCreateCustomBatch(configJson, { skipReadyCheck: true });
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.contains(
      `[data-test=batchLine]`,
      "cytest_08_Invalid_Config_NoGithubRepo"
    ).contains("Failed");
  });
});
