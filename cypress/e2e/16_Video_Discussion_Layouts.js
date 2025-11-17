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

      // Some CI environments boot with `TEST_CONTROLS=enabled`, which hides the call UI
      // behind a manual button. Make sure the content stays visible before each assertion.
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
        cy.get(
          `[data-player-id='${playerKey}'] button[data-test='submitButton']`
        )
          .contains("Start Test")
          .click();
      });

      playerKeys.forEach((playerKey) => {
        cy.waitForGameLoad(playerKey);
      });
      ensureDevContentEnabled();

      let activePlayers = [...playerKeys];

      const assertStageVisible = (players, label) => {
        players.forEach((playerKey) => cy.playerCanSee(playerKey, label));
        ensureDevContentEnabled();
      };

      // Snapshot player IDs keyed by their assigned Empirica position so later assertions
      // (like breakout rooms) don’t depend on join order.
      const playerKeyByPosition = {};
      cy.get(`input[data-test="playerPosition"]`)
        .each(($el, index) => {
          cy.wrap($el)
            .invoke("val")
            .then(($val) => {
              if ($val !== "") {
                playerKeyByPosition[$val] = playerKeys[index];
              }
            });
        })
        .then(() => {
          cy.wrap(playerKeyByPosition).as("playerKeyByPosition");
        });

      assertStageVisible(playerKeys, "Stage 0: Responsive default");
      playerKeys.forEach((viewer) => {
        cy.get(`[data-player-id='${viewer}'] [data-test='callTile']`).should(
          "have.length",
          playerKeys.length
        );
      });

      // One player leaves early to test "participant left" tile handling
      // Recreate a “participant left” scenario so we can verify the special tile.
      const leavingPlayer = playerKeys[0];
      const remainingPlayers = playerKeys.slice(1);
      cy.submitStage(leavingPlayer);
      remainingPlayers.forEach((viewer) => {
        cy.get(`[data-player-id='${viewer}'] [data-test='participantLeftTile']`)
          .should("be.visible")
          .and("contain.text", "Participant has left the call.");
      });
      cy.submitPlayers(remainingPlayers);
      activePlayers = [...playerKeys];

      // Stage 1: custom 2x2 grid should render equally sized tiles for all peers.
      assertStageVisible(activePlayers, "Stage 1: Two-by-Two Grid");
      activePlayers.forEach((viewer) => {
        cy.get(`[data-player-id='${viewer}'] [data-test='callTile']`).then(
          ($tiles) => {
            expect($tiles.length, "should render full grid of tiles").to.eq(
              playerKeys.length
            );

            const firstRect = $tiles[0].getBoundingClientRect();
            Cypress._.each($tiles, (tile) => {
              const { width, height } = tile.getBoundingClientRect();
              expect(
                width,
                "grid tile widths should match"
              ).to.be.closeTo(firstRect.width, 10);
              expect(
                height,
                "grid tile heights should match"
              ).to.be.closeTo(firstRect.height, 10);
            });
          }
        );
      });
      cy.submitPlayers(activePlayers);

      // Stage 2: picture-in-picture layout with a smaller self-view and an audio-only feed.
      assertStageVisible(activePlayers, "Stage 2: Picture-in-Picture");
      // Verify self-view tile is roughly one quarter width of the call column.
      activePlayers.forEach((viewer) => {
        cy.get(`[data-player-id='${viewer}'] [data-test='discussion']`).then(
          ($discussion) => {
            const discussionWidth = $discussion.width();

            cy.get(
              `[data-player-id='${viewer}'] [data-test='callTile'][data-source='self']`
            ).then(($selfTile) => {
              const ratio = $selfTile.width() / discussionWidth;
              // Self view should be roughly one quarter the width of the full call column.
              expect(ratio, "self tile width ratio").to.be.within(0.2, 0.35);
            });
          }
        );
      });

      // Verify that the audio-only tile is shown for the correct participant.
      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        ["0", "1"].forEach((pos) => {
          const viewer = keyByPosition[pos];
          expect(viewer, `player with position ${pos} should exist`).to.exist;
          cy.get(
            `[data-player-id='${viewer}'] [data-test='audioOnlyTile']`
          ).should("exist");
        });
      });
      cy.submitPlayers(activePlayers);

      // Stage 3: telephone game prompt + default layout smoke test.
      assertStageVisible(activePlayers, "Stage 3: Telephone Game");
      cy.submitPlayers(activePlayers);

      // Stage 4: breakout rooms—positions 0 & 1 share a room, position 2 is solo.
      assertStageVisible(activePlayers, "Stage 4: Breakout Rooms");
      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        ["0", "1"].forEach((pos) => {
          const viewer = keyByPosition[pos];
          expect(viewer, `player with position ${pos} should exist`).to.exist;
          cy.get(`[data-player-id='${viewer}'] [data-test='callTile']`).should(
            "have.length",
            2
          );
        });

        const soloViewer = keyByPosition["2"];
        expect(soloViewer, "player with position 2 should exist").to.exist;
        cy.get(
          `[data-player-id='${soloViewer}'] [data-test='callTile']`
        ).should("have.length", 1);
        cy.get(`[data-player-id='${soloViewer}']`).contains(
          "You are the only participant assigned to this room."
        );
      });
      cy.submitPlayers(activePlayers);

      // Stage 5: hide self view—no tile shows the local participant, but the grid
      // still includes the correct number of remote tiles.
      assertStageVisible(activePlayers, "Stage 5: Hide Self View");
      activePlayers.forEach((viewer) => {
        cy.get(`[data-player-id='${viewer}'] [data-test='callTile']`).should(
          "have.length",
          playerKeys.length - 1
        );
        cy.get(`[data-player-id='${viewer}'] [data-test='callTile']`).each(
          ($tile) => {
            expect(
              $tile.data("source"),
              "tile data-source should not be self"
            ).to.not.equal("self");
          }
        );
      });
      cy.submitPlayers(activePlayers);

      playerKeys.forEach((playerKey) => {
        cy.stepQCSurvey(playerKey);
      });

      cy.get("@consoleError").should("not.have.been.called");
    });
  }
);
