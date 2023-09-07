describe("Returning Player", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    // using beforeEach even though there is just one test, so that if we retry the test it will run again
    cy.empiricaClearBatches();

    const configJson = `{
          "batchName": "cytest_07_Returning_Player",
          "treatmentFile": "projects/example/treatments.test.yaml",
          "dispatchWait": 1,
          "cdn": "test",
          "treatments": [
            "cypress1_simple"
          ],
          "videoStorageLocation": "deliberation-lab-recordings-test",
          "dataRepos": [
            {
              "owner": "Watts-Lab",
              "repo": "deliberation-data-test",
              "branch": "main",
              "directory": "cypress_test_exports"
            }
          ]
        }`;

    cy.empiricaCreateCustomBatch(configJson, {});
    cy.wait(3000); // wait for batch creation callbacks to complete
    cy.empiricaStartBatch(1);
  });

  it("recovers old deliberationId", () => {
    const playerKeys = [
      `returning_testplayer_${Math.floor(Math.random() * 1e13)}`,
    ];
    const testDeliberationId = `myDeliberationId_${Math.floor(
      Math.random() * 1e13
    )}`;
    const participantData = `{"type":"meta","key":"platformId","val":"noWorkerIdGiven_${playerKeys[0]}","ts":"2023-08-24T01:08:52.671Z"}
        {"type":"meta","key":"deliberationId","val":"${testDeliberationId}","ts":"2023-08-24T01:08:52.671Z"}`;

    cy.writeFile(
      `../data/participantData/noWorkerIdGiven_${playerKeys[0]}.jsonl`,
      participantData,
      "utf8"
    );

    const hitId = "cypressTestHIT";
    // Consent and Login
    cy.empiricaLoginPlayers({ playerKeys, hitId });
    cy.wait(2000); // wait for player join callbacks to complete

    cy.window().then((win) => {
      cy.spy(win.console, "log").as("consoleLog");
    });

    // Consent
    cy.stepConsent(playerKeys[0]);

    // Check that the player has the correct deliberationId
    cy.window().then((win) =>
      cy.wrap(win.deliberationId).should("eq", testDeliberationId)
    );
  });
});
