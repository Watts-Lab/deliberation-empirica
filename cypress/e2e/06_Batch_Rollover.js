const configJson = `{
  "treatmentFile": "treatments.test.yaml",
  "dispatchWait": 3,
  "useTreatments": [
    "cypress_omnibus"
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
      cy.empiricaLoginPlayers({ playerKeys });

      //--------------------------------
      // Advance first players into game
      cy.stepInstructions(playerKeys[0]);
      cy.stepInstructions(playerKeys[1]);

      cy.stepVideoCheck(playerKeys[0]);
      cy.stepVideoCheck(playerKeys[1]);

      //--------------------------------
      // Advance slower players into game
      cy.stepInstructions(playerKeys[2]);
      cy.stepInstructions(playerKeys[3]);

      cy.stepVideoCheck(playerKeys[2]);
      cy.stepVideoCheck(playerKeys[3]);
    });
  }
);
