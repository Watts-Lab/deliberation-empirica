describe("Returning Player", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();
  });

  it("throws error when videoStorageLocation is invalid", () => {
    const configJson = `{
            "batchName": "cytest_08_Invalid_Config_VideoStorageLocation",
            "treatmentFile": "projects/example/treatments.test.yaml",
            "dispatchWait": 1,
            "cdn": "test",
            "treatments": [
              "cypress1_simples"
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

    cy.empiricaCreateCustomBatch(configJson);
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.contains(
      `[data-test=batchLine]`,
      "cytest_08_Invalid_Config_VideoStorageLocation"
    ).contains("Failed");
  });
});
