/* eslint-disable no-restricted-syntax */

const dispatchConfigFixture = require("../fixtures/mockCDN/test/dispatchConditions/test.config.json");

describe(
  "Lobby dispatch conditions",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      cy.empiricaClearBatches();
      const config = { ...dispatchConfigFixture };
      cy.empiricaCreateCustomBatch(JSON.stringify(config), {});
      cy.wait(3000);
      cy.empiricaStartBatch(1);
    });

    it("delays assignment until two dispatch events occur", () => {
      const playerKeys = [
        `test_dispatch_A_${Math.floor(Math.random() * 1e13)}`,
        `test_dispatch_B_${Math.floor(Math.random() * 1e13)}`,
      ];
      cy.empiricaSetupWindow({ playerKeys });
      cy.interceptIpApis();

      const [firstPlayer, secondPlayer] = playerKeys;

      const runIntro = (playerKey) => {
        cy.stepIntro(playerKey);
        cy.stepConsent(playerKey);
        cy.stepAttentionCheck(playerKey);
        cy.stepNickname(playerKey);
      };

      runIntro(firstPlayer);
      cy.wrap(Date.now()).as("firstLobbyStart");

      cy.window().then((win) => {
        cy.wrap(win.batchLabel).as("batchLabel");
      });

      cy.wait(5000); // dispatch wait is 1, so wait a bit before running second intro so they actually fire two events

      // run intro for second player to trigger second dispatch
      runIntro(secondPlayer);

      // check that first player matched after second dispatch
      cy.waitForGameLoad(firstPlayer);

      cy.get(`[data-player-id="${firstPlayer}"]`, {
        timeout: 15000,
      }).contains("Matched on second dispatch");

      // check that second player still in lobby
      cy.get(`[data-player-id="${secondPlayer}"]`, {
        timeout: 15000,
      }).contains("Matching you with a group");

      cy.empiricaClearBatches();
      cy.wait(3000);

      // check that dispatch events were recorded correctly
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(`../data/batch_${batchLabel}.scienceData.jsonl`)
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            return lines.map((line) => JSON.parse(line));
          })
          .as("dispatchData");
      });

      cy.get("@dispatchData").then((dataObjects) => {
        expect(dataObjects.length).to.be.greaterThan(0);
        const firstRecord = dataObjects.find(
          (obj) => obj?.prompts?.prompt_waitPrompt
        );
        expect(firstRecord?.dispatchEvents?.length).to.be.greaterThan(1);
        expect(
          firstRecord?.stageDurations?.duration_lobby.time
        ).to.be.greaterThan(4);
      });
    });
  }
);
