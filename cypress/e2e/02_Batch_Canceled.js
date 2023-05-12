// Batch_Canceled.js

const configJson = `{
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 1,
  "cdn": "test",
  "useTreatments": [
    "cypress1_simple"
  ]
}`;

describe("Batch canceled", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();

    cy.empiricaCreateCustomBatch(configJson);
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.empiricaStartBatch(1);
  });

  it("from intro steps", () => {
    const playerKeys = [`test_intro_${Math.floor(Math.random() * 1e13)}`];
    // Consent and Login
    cy.empiricaLoginPlayers({ playerKeys });
    // Cancel Batch
    cy.empiricaClearBatches(); // has a 5 second delay in it, need to subtract from participants payment

    // Check that player canceled
    cy.visit(`/?playerKey=${playerKeys[0]}`);
    cy.contains("About this study").should("not.exist");

    // Should boot to QC survey with sorry message
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Server error", {
      timeout: 10000,
    });
  });

  it("from game", () => {
    // Consent and Login
    const playerKeys = [`test_game_${Math.floor(Math.random() * 1e13)}`];

    // Enter Game
    cy.empiricaLoginPlayers({ playerKeys });
    cy.stepConsent(playerKeys[0]);
    cy.stepVideoCheck(playerKeys[0]);
    cy.stepNickname(playerKeys[0]);
    cy.stepSurveyPoliticalPartyUS(playerKeys[0]);

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Cancel Batch
    cy.empiricaClearBatches(); // clear batches has a 5 second delay in it, need to subtract from participants payment

    // Should boot to exit steps
    cy.visit(`/?playerKey=${playerKeys[0]}`);
    cy.stepTeamViabilitySurvey(playerKeys[0]);
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
      "Thank you for participating",
      { timeout: 10000 }
    );
  });
});
