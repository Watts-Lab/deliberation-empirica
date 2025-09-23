const configJson = `{
    "batchName": "cytest_13",
    "cdn": "test",
    "treatmentFile": "projects/example/cypress.treatments.yaml",
    "customIdInstructions": "none",
    "platformConsent": "US",
    "consentAddendum": "none",
    "checkAudio": false,
    "checkVideo": false,
    "introSequence": "cypress_intro",
    "treatments": [
      "cypress_constrained_1",
      "cypress_constrained_2",
      "cypress_constrained_3",
      "cypress_constrained_4"
    ],
    "payoffs": [1, 1, 0.8, 1],
    "knockdowns": 0.9,
    "dispatchWait": 2,
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

describe(
  "Constrained Assignment",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      cy.empiricaClearBatches();
      cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file
      cy.empiricaCreateCustomBatch(configJson, {});
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("assigns players to the correct games", () => {
      const playerKeys = Array(9)
        .fill()
        .map(
          (a, index) =>
            `testplayer_${index}_${Math.floor(Math.random() * 1e13)}`
        );

      // Consent and Login
      cy.empiricaSetupWindow({ playerKeys, workerId: "testWorker" });
      cy.interceptIpApis();

      playerKeys.forEach((playerKey) => {
        cy.stepIntro(playerKey, {}); // no audio or video check
      });

      playerKeys.forEach((playerKey) => {
        cy.stepConsent(playerKey);
      });

      playerKeys.forEach((playerKey) => {
        cy.stepAttentionCheck(playerKey);
        cy.stepVideoCheck(playerKey, {
          setupCamera: false,
          setupMicrophone: false,
        });
        cy.stepNickname(playerKey);
      });

      // Player 0 is eligible for 1a or 3
      cy.stepSurveyPoliticalPartyUS(playerKeys[0], "Republican");

      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      // Player 1 is eligible for 1b or 3
      cy.stepSurveyPoliticalPartyUS(playerKeys[1], "Republican");
      cy.get(
        `[data-player-id="${playerKeys[1]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      // Player 2 is eligible for 1a, 2a, or 3
      cy.stepSurveyPoliticalPartyUS(playerKeys[2], "Republican");
      cy.get(
        `[data-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 3 is eligible for 1b, 2b, or 3
      cy.stepSurveyPoliticalPartyUS(playerKeys[3], "Republican");
      cy.get(
        `[data-player-id="${playerKeys[3]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[3]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 4 is eligible for 1a, 2a, or 3
      cy.stepSurveyPoliticalPartyUS(playerKeys[4], "Republican");
      cy.get(
        `[data-player-id="${playerKeys[4]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[4]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 5 is eligible for 1b, 2b, or 3
      cy.stepSurveyPoliticalPartyUS(playerKeys[5], "Republican");
      cy.get(
        `[data-player-id="${playerKeys[5]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[5]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 6 is eligible for 1a, 2a, or 3
      cy.stepSurveyPoliticalPartyUS(playerKeys[6], "Republican");
      cy.get(
        `[data-player-id="${playerKeys[6]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[6]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 7 is only eligible for 4a
      cy.stepSurveyPoliticalPartyUS(playerKeys[7], "Democrat");

      // Player 8 is only eligible for 4b
      cy.stepSurveyPoliticalPartyUS(playerKeys[8], "Republican");

      // players 0 and 1 go through first dispatch, and are assigned to treatments 1a and 1b
      cy.submitPlayers(playerKeys.slice(0, 2)); // submit first two players

      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      cy.playerCanSee(playerKeys[0], "TestDisplay00");
      cy.playerCanSee(playerKeys[1], "TestDisplay01");

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit first two players

      // players 2 and 3 go through second dispatch and are assigned to treatments 2a and 2b
      // this tests persistence of the knocked-down payoffs
      // not a super strong test, because it could pass by chance
      cy.submitPlayers(playerKeys.slice(2, 4));

      cy.waitForGameLoad(playerKeys[2]);
      cy.waitForGameLoad(playerKeys[3]);

      cy.playerCanSee(playerKeys[2], "TestDisplay02");
      cy.playerCanSee(playerKeys[3], "TestDisplay03");

      cy.submitPlayers(playerKeys.slice(2, 4));

      // players 4-6 go through third dispatch and are assigned to treatment 3
      cy.submitPlayers(playerKeys.slice(4, 7));

      cy.waitForGameLoad(playerKeys[4]);
      cy.waitForGameLoad(playerKeys[5]);
      cy.waitForGameLoad(playerKeys[6]);

      cy.contains("TestDisplay04");
      cy.contains("TestDisplay05");
      cy.contains("TestDisplay06");

      cy.submitPlayers(playerKeys.slice(4, 7));

      // players 7 and 8 go through third dispatch and are assigned to treatment 4 democrat and republican respectively
      cy.submitPlayers(playerKeys.slice(7, 9));
      cy.playerCanSee(playerKeys[7], "TestDisplay07");
      cy.playerCanSee(playerKeys[8], "TestDisplay08");
    });
  }
);
