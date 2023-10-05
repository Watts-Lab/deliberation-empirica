// Batch_Canceled.js

const configJson = `{
  "batchName": "cytest_02",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 1,
  "cdn": "test",
  "introSequence": "cypress_intro",
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

describe("Batch canceled", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();

    cy.empiricaCreateCustomBatch(configJson, {});
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.empiricaStartBatch(1);
  });

  it("from intro steps", () => {
    const playerKeys = [`test_intro_${Math.floor(Math.random() * 1e13)}`];
    // Consent and Login
    cy.empiricaSetupWindow({ playerKeys });
    cy.stepIntro(playerKeys[0], { checks: ["webcam", "mic", "headphones"] });

    // Cancel Batch
    cy.empiricaClearBatches(); // has a 5 second delay in it, need to subtract from participants payment

    // Check that player canceled
    cy.visit(`/?playerKey=${playerKeys[0]}`);
    cy.contains("About this study").should("not.exist");

    // Should boot to server error message
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Server error", {
      timeout: 10000,
    });
  });

  it("from game", () => {
    // Consent and Login
    const playerKeys = [`test_game_${Math.floor(Math.random() * 1e13)}`];

    // Enter Game
    cy.empiricaSetupWindow({ playerKeys });
    cy.stepIntro(playerKeys[0], { checks: ["webcam", "mic", "headphones"] });
    cy.stepConsent(playerKeys[0]);
    cy.stepVideoCheck(playerKeys[0], { headphonesRequired: true });
    cy.stepNickname(playerKeys[0]);
    cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
    cy.get(
      `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
    ).click();
    cy.submitPlayers(playerKeys);

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Cancel Batch
    cy.empiricaClearBatches();

    // Should boot to server error message
    cy.visit(`/?playerKey=${playerKeys[0]}`);
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Server error", {
      timeout: 10000,
    });
  });

  it("displays intro sequence after cancel from game", () => {
    // Consent and Login
    const playerKeys = [`test_game_${Math.floor(Math.random() * 1e13)}`];

    // Enter Game
    cy.empiricaSetupWindow({ playerKeys });
    cy.stepIntro(playerKeys[0], { checks: ["webcam", "mic", "headphones"] });
    cy.stepConsent(playerKeys[0]);
    cy.stepVideoCheck(playerKeys[0], { headphonesRequired: true });
    cy.stepNickname(playerKeys[0]);
    cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
    cy.get(
      `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
    ).click();
    cy.submitPlayers(playerKeys);

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Cancel Batch
    cy.empiricaClearBatches();

    // Should boot to server error message
    cy.visit(`/?playerKey=${playerKeys[0]}`);
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Server error", {
      timeout: 10000,
    });
  });
});
