describe(
  "Multiplayer Text Chat",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "cytest_03_textChat",
        "cdn": "test",
        "treatmentFile": "projects/example/cypress.treatments.yaml",
        "customIdInstructions": "none",
        "platformConsent": "US",
        "consentAddendum": "none",
        "checkAudio": false,
        "checkVideo": false,
        "introSequence": "none",
        "treatments": [
          "cypress_textChat"
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
        "exitCodes": "none"
      }`;

      cy.empiricaCreateCustomBatch(configJson, {});
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
      cy.interceptIpApis();
      cy.stepIntro(playerKeys[0], {}); // no audio or video check
      cy.stepIntro(playerKeys[1], {});

      cy.window().then((win) => {
        cy.spy(win.console, "log").as("consoleLog");
      });

      // Consent
      cy.stepConsent(playerKeys[0]);
      cy.stepConsent(playerKeys[1]);

      cy.window().then((win) => cy.wrap(win.batchLabel).as("batchLabel"));

      // Attention Check
      cy.stepAttentionCheck(playerKeys[0]);
      cy.stepAttentionCheck(playerKeys[1]);

      // // Video check
      cy.stepVideoCheck(playerKeys[0], {
        setupMicrophone: false,
        setupCamera: false,
      });
      cy.stepVideoCheck(playerKeys[1], {
        setupMicrophone: false,
        setupCamera: false,
      });

      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);

      // Lobby
      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // ---------- First text chat ----------
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

      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        `First: Hello from testplayer_A, ${playerKeys[0]}`
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        `Second: Hello from testplayer_B, ${playerKeys[1]}`
      );
      cy.get(`[data-player-id="${playerKeys[1]}"]`).contains(
        `Third: Goodbye from testplayer_A, ${playerKeys[0]}`
      );
      cy.get(`[data-player-id="${playerKeys[1]}"]`).contains(
        `Fourth: Goodbye from testplayer_B, ${playerKeys[1]}`
      );

      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        `nickname_testplayer_A`
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        `(Title-A-Position-0)`
      );

      // TODO: should probably check the order of the messages
      cy.submitPlayers(playerKeys); // submit both players

      // ---------- Second text chat ----------
      // messages from previous chat should be gone
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains(`First: Hello from testplayer_A, ${playerKeys[0]}`)
        .should("not.exist");

      cy.wait(1000);

      cy.typeInChat(
        playerKeys[0],
        `Fifth: Hello again from testplayer_A, ${playerKeys[0]}`
      );
      cy.typeInChat(
        playerKeys[1],
        `Second: Hello again from testplayer_B, ${playerKeys[1]}`
      );

      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        `Title-A-Position-0`
      );

      cy.get(`[data-player-id="${playerKeys[0]}"]`) // no parentheses
        .contains(`(Title-A-Position-0)`)
        .should("not.exist");

      cy.submitPlayers(playerKeys); // submit both players

      // ----------- Exit Steps -----------
      // No exit surveys
      cy.stepQCSurvey(playerKeys[0]);
      cy.stepQCSurvey(playerKeys[1]);

      // Check that no payment code is displayed when the exitCodeStem is "none"
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains("Finished");
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("200")
        .should("not.exist");

      // end the batch
      cy.empiricaClearBatches();

      // check that messages saved to datafile

      // get science data
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(`../data/batch_${batchLabel}.scienceData.jsonl`)
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            return objs;
          })
          .as("dataObjects");
      });

      // check that data is output as we expect
      cy.get("@dataObjects").then((dataObjects) => {
        const data = dataObjects[0];
        expect(Object.keys(data.chatActions)).to.have.lengthOf(2);
        
        // Check first chat has actions
        const firstChatActions = data.chatActions["First Text Chat"];
        expect(firstChatActions).to.be.an("array");
        expect(firstChatActions.length).to.be.above(0);
        
        // Find the first message action
        const firstMessage = firstChatActions.find(
          (action) => action.type === "send_message" && action.content.includes("First: Hello from testplayer_A")
        );
        expect(firstMessage).to.exist;
        expect(firstMessage.stage).to.equal("game_0_First_Text_Chat");
        expect(firstMessage.sender.title).to.include("Title-");
        
        // Check second chat has actions
        const secondChatActions = data.chatActions["Second Text Chat"];
        expect(secondChatActions).to.be.an("array");
        expect(secondChatActions.length).to.be.above(0);
        
        // Find a message from the second chat
        const fifthMessage = secondChatActions.find(
          (action) => action.type === "send_message" && action.content.includes("Fifth: Hello again from testplayer_A")
        );
        expect(fifthMessage).to.exist;
        expect(fifthMessage.time).to.be.above(0);
        expect(fifthMessage.stage).to.equal("game_1_Second_Text_Chat");
      });
    });
  }
);
