const configJson = `{
  "batchName": "cytest_06",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 2,
  "cdn": "test",
  "treatments": [
    "cypress_omnibus"
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

describe(
  "Multiplayer Batch Rollover",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.empiricaCreateCustomBatch(configJson);
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("assigns players to next batch", () => {
      const playerKeys = [
        `test_A_${Math.floor(Math.random() * 1e13)}`,
        `test_B_${Math.floor(Math.random() * 1e13)}`,
        `test_C_${Math.floor(Math.random() * 1e13)}`,
        `test_D_${Math.floor(Math.random() * 1e13)}`,
      ];

      // Consent and Login
      cy.empiricaSetupWindow({ playerKeys });
      cy.stepIntro(playerKeys[0], { checks: ["webcam", "mic", "headphones"] });
      cy.stepIntro(playerKeys[1], { checks: ["webcam", "mic", "headphones"] });
      cy.stepIntro(playerKeys[2], { checks: ["webcam", "mic", "headphones"] });
      cy.stepIntro(playerKeys[3], { checks: ["webcam", "mic", "headphones"] });

      //--------------------------------
      // Advance first players into game
      cy.stepConsent(playerKeys[0]);
      cy.stepConsent(playerKeys[1]);

      cy.stepVideoCheck(playerKeys[0]);
      cy.stepVideoCheck(playerKeys[1]);

      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);

      // straight to game
      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      //--------------------------------
      // Advance slower players into game
      cy.wait(5000);
      cy.stepConsent(playerKeys[2]);
      cy.stepConsent(playerKeys[3]);

      cy.stepVideoCheck(playerKeys[2]);
      cy.stepVideoCheck(playerKeys[3]);

      cy.stepNickname(playerKeys[2]);
      cy.stepNickname(playerKeys[3]);

      // straight to game
      cy.waitForGameLoad(playerKeys[2]);
      cy.waitForGameLoad(playerKeys[3]);
    });
  }
);
