describe(
  "Multiplayer Text Chat",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "cytest_03_textChat",
        "treatmentFile": "projects/example/treatments.test.yaml",
        "dispatchWait": 1,
        "cdn": "test",
        "treatments": [
          "cypress_textChat"
        ],
        "videoStorageLocation": false,
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

      cy.empiricaCreateCustomBatch(configJson);
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("walks properly", () => {
      const playerKeys = [
        `testplayer_A_${Math.floor(Math.random() * 1e13)}`,
        `testplayer_B_${Math.floor(Math.random() * 1e13)}`,
      ];

      const hitId = "cypressTestHIT";
      // Consent and Login
      cy.empiricaSetupWindow({ playerKeys, hitId });
      cy.stepIntro(playerKeys[0], {}); // no audio or video check
      cy.stepIntro(playerKeys[1], {});

      cy.window().then((win) => {
        cy.spy(win.console, "log").as("consoleLog");
      });

      // Consent
      cy.stepConsent(playerKeys[0]);
      cy.stepConsent(playerKeys[1]);

      cy.window().then((win) =>
        cy.wrap(win.batchTimeInitialized).as("batchTimeInitialized")
      );

      // Video check
      cy.stepVideoCheck(playerKeys[0]);
      cy.stepVideoCheck(playerKeys[1]);

      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);

      // Lobby
      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // Test text chat
      cy.typeInChat(
        playerKeys[0],
        `First: Hello from testplayer_A, ${playerKeys[0]}`
      );
      cy.typeInChat(
        playerKeys[1],
        `Second: Hello from testplayer_B, ${playerKeys[1]}`
      );
      cy.typeInChat(
        playerKeys[0],
        `Third: Goodbye from testplayer_A, ${playerKeys[0]}`
      );
      cy.typeInChat(
        playerKeys[1],
        `Fourth: Goodbye from testplayer_B, ${playerKeys[1]}`
      );

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        `First: Hello from testplayer_A, ${playerKeys[0]}`
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        `Second: Hello from testplayer_B, ${playerKeys[1]}`
      );
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        `Third: Goodbye from testplayer_A, ${playerKeys[0]}`
      );
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        `Fourth: Goodbye from testplayer_B, ${playerKeys[1]}`
      );
      // TODO: should probably check the order of the messages

      cy.submitStage(playerKeys[0]);
      cy.submitStage(playerKeys[1]);

      // No exit steps
      cy.stepQCSurvey(playerKeys[0]);
      cy.stepQCSurvey(playerKeys[1]);

      // end the batch
      cy.empiricaClearBatches();

      // check that messages saved to datafile
      cy.get("@batchTimeInitialized").then((batchTimeInitialized) => {
        cy.readFile(
          `../data/scienceData/batch_${batchTimeInitialized}_cytest_03_textChat.jsonl`
        )
          .should("match", /First: Hello from testplayer_A/)
          .should("match", /Second: Hello from testplayer_B/)
          .should("match", /Third: Goodbye from testplayer_A/)
          .should("match", /Fourth: Goodbye from testplayer_B/);
      });
    });
  }
);
