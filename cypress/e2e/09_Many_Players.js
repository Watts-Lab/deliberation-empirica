// Batch_Canceled.js

const configJson = `{
    "batchName": "cytest_03",
    "treatmentFile": "projects/example/treatments.test.yaml",
    "dispatchWait": 1,
    "cdn": "test",
    "videoStorageLocation": false,
    "checkAudio": false,
    "checkVideo": false,
    "treatments": [
      "cypress3_load_test"
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

describe("Load test", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();

    cy.empiricaCreateCustomBatch(configJson, {});
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.empiricaStartBatch(1);
  });

  it("the crowd goes wild", () => {
    const playerKeys = Array(8)
      .fill()
      .map(
        (a, index) => `testplayer_${index}_${Math.floor(Math.random() * 1e13)}`
      );
    // Consent and Login
    cy.empiricaSetupWindow({ playerKeys });

    playerKeys.forEach((playerKey) => {
      cy.stepIntro(playerKey, {}); // no audio or video check
    });

    playerKeys.forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    playerKeys.forEach((playerKey) => {
      cy.stepAttentionCheck(playerKey);
      cy.stepVideoCheck(playerKey, { headphonesRequired: false });
      cy.stepNickname(playerKey);
    });

    playerKeys.forEach((playerKey) => {
      cy.waitForGameLoad(playerKey);
    });

    const wizards = [
      "Ponder Stibbons",
      "Albus Dumbledore",
      "Harry Dresden",
      "Eskarina Smith",
      "Ged/Sparrowhawk",
      "Gandalf",
      "Dr. Strange",
      "Merlin",
      "Thomas Edison",
    ];

    const colors = ["Octarine", "Hooloovoo", "Ultrablack", "Ulfire", "Plaid"];

    Array(20)
      .fill()
      .forEach(() => {
        playerKeys.forEach((playerKey) => {
          const randomWizard =
            wizards[Math.floor(Math.random() * wizards.length)];
          cy.get(
            `[test-player-id="${playerKey}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="${randomWizard}"]`
          ).click();

          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          cy.get(
            `[test-player-id="${playerKey}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="${randomColor}"]`
          ).click();
        });
      });

    cy.submitPlayers(playerKeys);
    cy.wait(1000);
    playerKeys.forEach((playerKey) => {
      cy.stepTeamViabilitySurvey(playerKey);
      cy.stepQCSurvey(playerKey);
      cy.get(`[test-player-id="${playerKey}"]`).contains("Finished");
    });
  });
});
