/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
// Merlin fans vs (Gandalf or Eskarina Smith) fans
const configJson = `{
    "batchName": "cytest_14_templates",
    "cdn": "test",
    "treatmentFile": "projects/example/templates.treatments.yaml",
    "customIdInstructions": "none",
    "platformConsent": "US",
    "consentAddendum": "none",
    "checkAudio": false,
    "checkVideo": false,
    "introSequence": "template_test",
    "treatments": [
      "t_d0_2_d1_0" 
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
    "videoStorage": "none",
    "exitCodes": {
      "complete": "cypressComplete",
      "error": "cypressError",
      "lobbyTimeout": "cypressLobbyTimeout",
      "failedEquipmentCheck": "cypressFailedEquipmentCheck"
    }


}`;

describe("Templates", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    // using beforeEach even though there is just one test, so that if we retry the test it will run again
    cy.empiricaClearBatches();
    cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file

    cy.empiricaCreateCustomBatch(configJson, {});
    cy.wait(3000); // wait for batch creation callbacks to complete
    cy.empiricaStartBatch(1);
  });

  it("handles templates", () => {
    const playerKeys = [
      `testplayer_A_${Math.floor(Math.random() * 1e13)}`,
      `testplayer_A_${Math.floor(Math.random() * 1e13)}`,
      `testplayer_C_${Math.floor(Math.random() * 1e13)}`,
    ];
    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();

    cy.window().then((win) => {
      cy.spy(win.console, "log").as("consoleLog");
    });

    playerKeys.forEach((playerKey) => {
      cy.stepIntro(playerKey, {}); // no audio or video check
      cy.stepConsent(playerKey);
      cy.stepAttentionCheck(playerKey);
      // cy.stepVideoCheck(playerKey, { headphonesRequired: false });
      cy.stepNickname(playerKey);
    });

    cy.window().then((win) => cy.wrap(win.batchLabel).as("batchLabel"));

    // intro sequence
    cy.get(
      `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
    ).click();

    cy.get(
      `[test-player-id="${playerKeys[1]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Albus Dumbledore"]`
    ).click();

    cy.get(
      `[test-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Gandalf"]`
    ).click();

    cy.submitPlayers(playerKeys);
    cy.wait(1000);

    // first broadcast stage

    // check that the right treatment was assigned
    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("t_d0_2_d1_0 p1");

    cy.get(`[test-player-id="${playerKeys[2]}"]`).contains("t_d0_2_d1_0 p0");

    cy.get(
      `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
    ).click();

    cy.get(
      `[test-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
    ).click();

    cy.submitPlayers([playerKeys[0], playerKeys[2]]);

    // second broadcast stage
    cy.get(
      `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
    ).click();

    cy.get(
      `[test-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
    ).click();

    cy.submitPlayers([playerKeys[0], playerKeys[2]]);

    // third broadcast stage

    cy.get(
      `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Plaid"]`
    ).click();

    cy.get(
      `[test-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Plaid"]`
    ).click();

    cy.submitPlayers([playerKeys[0], playerKeys[2]]);

    // outer stage
    cy.get(
      `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
    ).click();

    cy.get(
      `[test-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
    ).click();

    cy.submitPlayers([playerKeys[0], playerKeys[2]]);

    [playerKeys[0], playerKeys[2]].forEach((playerKey) => {
      cy.stepQCSurvey(playerKey);
      cy.get(`[test-player-id="${playerKey}"]`).contains("Finished");
    });
  });
});
