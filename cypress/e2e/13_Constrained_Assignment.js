const configJson = `{
    "batchName": "cytest_13",
    "treatmentFile": "projects/example/cypress.treatments.yaml",
    "dispatchWait": 1,
    "cdn": "test",
    "exitCodeStem": "none",
    "introSequence": "cypress_intro",
    "treatments": [
        "cypress_constrained_1",
        "cypress_constrained_2",
        "cypress_constrained_3"
    ],
    "payoffs": [
        1,
        1,
        0.8
    ],
    "knockdowns": 0.9,
    "videoStorageLocation": "none",
    "checkAudio": false,
    "checkVideo": false,
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
      const playerKeys = Array(7)
        .fill()
        .map(
          (a, index) =>
            `testplayer_${index}_${Math.floor(Math.random() * 1e13)}`
        );

      // Consent and Login
      cy.empiricaSetupWindow({ playerKeys });
      cy.interceptIpApis();

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
        cy.stepSurveyPoliticalPartyUS(playerKey);
      });

      // Player 0 is eligible for 1a or 3
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      // Player 1 is eligible for 1b or 3
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      // Player 2 is eligible for 1a, 2a, or 3
      cy.get(
        `[test-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 3 is eligible for 1b, 2b, or 3
      cy.get(
        `[test-player-id="${playerKeys[3]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[3]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 4 is eligible for 1a, 2a, or 3
      cy.get(
        `[test-player-id="${playerKeys[4]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[4]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 5 is eligible for 1b, 2b, or 3
      cy.get(
        `[test-player-id="${playerKeys[5]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[5]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      // Player 6 is eligible for 1a, 2a, or 3
      cy.get(
        `[test-player-id="${playerKeys[6]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[5]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

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

      cy.submitPlayers(playerKeys.slice(4, 6));
    });
  }
);
