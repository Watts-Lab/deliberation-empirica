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
      });

      playerKeys.forEach((playerKey) => {
        cy.waitForGameLoad(playerKey);
      });

      playerKeys.forEach((playerKey) => {
        cy.playerCanSee(playerKey, "Stage 1: Two-by-Two Grid");
      });

      cy.submitPlayers(playerKeys);

      playerKeys.forEach((playerKey) => {
        cy.playerCanSee(playerKey, "Stage 2: Picture-in-Picture");
      });

      cy.submitPlayers(playerKeys);

      playerKeys.forEach((playerKey) => {
        cy.stepQCSurvey(playerKey);
      });

      cy.get("@consoleError").then((consoleError) => {
        expect(consoleError).not.to.have.been.called();
      });
    });
  }
);
