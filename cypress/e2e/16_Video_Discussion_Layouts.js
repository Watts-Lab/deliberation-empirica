const batchConfigFixture = require("../fixtures/mockCDN/test/discussionLayout/test.config.json");

describe(
  "Video Discussion Layouts",
  { retries: { runMode: 1, openMode: 0 } },
  () => {
    beforeEach(() => {
      cy.empiricaClearBatches();

      const config = {
        ...batchConfigFixture,
      };

      cy.empiricaCreateCustomBatch(JSON.stringify(config), {});
      cy.wait(3000);
      cy.empiricaStartBatch(1);
    });

    it("loads custom layouts for each stage", () => {
      const playerKeys = [
        `videoLayout_A_${Math.floor(Math.random() * 1e13)}`,
        `videoLayout_B_${Math.floor(Math.random() * 1e13)}`,
        `videoLayout_C_${Math.floor(Math.random() * 1e13)}`,
      ];
      const hitId = "videoLayoutTestHIT";

      const ensureDevContentEnabled = () => {
        playerKeys.forEach((playerKey) => {
          const selector = `[data-player-id='${playerKey}'] [data-test='enableContentButton']`;
          cy.get("body").then(($body) => {
            if ($body.find(selector).length > 0) {
              cy.get(selector).click();
            }
          });
        });
      };

      cy.empiricaSetupWindow({ playerKeys, hitId });
      cy.interceptIpApis();

      playerKeys.forEach((playerKey) => {
        cy.stepIntro(playerKey);
      });

      cy.window().then((win) => {
        cy.spy(win.console, "error").as("consoleError");
      });

      playerKeys.forEach((playerKey) => {
        cy.stepConsent(playerKey);
        cy.stepAttentionCheck(playerKey);
        cy.stepVideoCheck(playerKey, {
          setupMicrophone: false,
          setupCamera: false,
          setupHeadphones: false,
        });
        cy.stepNickname(playerKey);
        cy.get(`[data-player-id='${playerKey}'] button[data-test='submitButton']`)
          .contains("Start Test")
          .click();
      });

      playerKeys.forEach((playerKey) => {
        cy.waitForGameLoad(playerKey);
      });
      ensureDevContentEnabled();

      const stageOrder = [
        {
          text: "Stage 0: Responsive default",
          assert: () => {
            const expectedTileCount = playerKeys.length;
            playerKeys.forEach((viewer) => {
              cy.get(
                `[data-player-id='${viewer}'] [data-test='callTile']`
              ).should("have.length", expectedTileCount);
            });
          },
        },
        { text: "Stage 1: Two-by-Two Grid" },
        { text: "Stage 2: Picture-in-Picture" },
        { text: "Stage 3: Telephone Game" },
        {
          text: "Stage 4: Breakout Rooms",
          assert: () => {
            const roomOne = playerKeys.slice(0, 2);
            const soloPlayer = playerKeys[2];
            const soloPosition = "2";

            roomOne.forEach((viewer) => {
              cy.get(
                `[data-player-id='${viewer}'] [data-test='callTile']`
              ).should("have.length", 2);
              cy.get(
                `[data-player-id='${viewer}'] [data-position='${soloPosition}']`
              ).should("not.exist");
            });

            cy.get(
              `[data-player-id='${soloPlayer}'] [data-test='callTile']`
            ).should("have.length", 1);
          },
        },
        {
          text: "Stage 5: Hide Self View",
          assert: () => {
            playerKeys.forEach((viewer) => {
              cy.get(
                `[data-player-id='${viewer}'] [data-test='discussion']`
              ).should("not.contain", "(you)");
              cy.get(
                `[data-player-id='${viewer}'] [data-test='callTile'][data-source='self']`
              ).should("not.exist");
            });
          },
        },
      ];

      stageOrder.forEach(({ text, assert }) => {
        playerKeys.forEach((playerKey) => {
          cy.playerCanSee(playerKey, text);
        });
        ensureDevContentEnabled();
        if (assert) {
          assert();
        }
        cy.submitPlayers(playerKeys);
      });

      playerKeys.forEach((playerKey) => {
        cy.stepQCSurvey(playerKey);
      });

      cy.get("@consoleError").should("not.have.been.called");
    });
  }
);
