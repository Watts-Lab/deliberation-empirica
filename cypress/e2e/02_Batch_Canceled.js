// Batch_Canceled.js

const configJsonA = `{
  "batchName": "cytest_02A",
  "treatmentFile": "projects/example/cypress.treatments.yaml",
  "dispatchWait": 1,
  "cdn": "test",
  "exitCodeStem": "cypress",
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

const configJsonB = `{
  "batchName": "cytest_02B",
  "treatmentFile": "projects/example/cypress.treatments.yaml",
  "dispatchWait": 1,
  "cdn": "test",
  "exitCodeStem": "cypress",
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
  it("from intro steps", () => {
    cy.empiricaClearBatches();
    cy.empiricaCreateCustomBatch(configJsonA, {});
    cy.wait(3000); // wait for batch creation callbacks to complete
    cy.empiricaStartBatch(1);

    const playerKeys = [`test_intro_${Math.floor(Math.random() * 1e13)}`];
    // Consent and Login
    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();
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
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("cypress500", {
      timeout: 10000,
    });
  });

  it("from game", () => {
    cy.empiricaClearBatches();
    cy.empiricaCreateCustomBatch(configJsonB, {});
    cy.wait(3000); // wait for batch creation callbacks to complete
    cy.empiricaStartBatch(1);

    // Consent and Login
    const playerKeys = [`test_game_${Math.floor(Math.random() * 1e13)}`];

    // Enter Game
    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();
    cy.stepIntro(playerKeys[0], { checks: ["webcam", "mic", "headphones"] });
    cy.stepConsent(playerKeys[0]);

    cy.window().then((win) => {
      cy.wrap(win.batchLabel).as("batchLabel");
    });

    // Attention Check
    cy.stepAttentionCheck(playerKeys[0]);

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
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("cypress500", {
      timeout: 10000,
    });

    cy.wait(3000); // wait for batch close callbacks to complete
    // load the data
    cy.get("@batchLabel").then((batchLabel) => {
      cy.readFile(`../data/batch_${batchLabel}.scienceData.jsonl`)
        .then((txt) => {
          const lines = txt.split("\n").filter((line) => line.length > 0);
          const objs = lines.map((line) => JSON.parse(line));
          console.log("dataObjects", objs);
          return objs;
        })
        .as("dataObjects");
    });

    cy.get("@dataObjects").then((objs) => {
      expect(objs.length).to.equal(1);
      expect(objs[0].exitStatus).to.equal("incomplete");
    });
  });
});
