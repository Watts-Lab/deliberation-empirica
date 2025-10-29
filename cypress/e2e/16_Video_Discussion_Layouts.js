describe(
  "Video Discussion Layouts",
  { retries: { runMode: 1, openMode: 0 } },
  () => {
    const layoutTreatmentFile =
      "test/discussionLayout/testDiscussionLayout.treatments.yaml";

    beforeEach(() => {
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "cytest_video_layout",
        "cdn": "test",
        "treatmentFile": "${layoutTreatmentFile}",
        "customIdInstructions": "none",
        "platformConsent": "US",
        "consentAddendum": "none",
        "checkAudio": false,
        "checkVideo": false,
        "introSequence": "discussion_layout_intro",
        "treatments": [
          "video_layout_demo"
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

      cy.intercept("GET", `**/${layoutTreatmentFile}`).as("layoutFixture");

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

      cy.wait("@layoutFixture")
        .its("response.body")
        .then((body) => {
          expect(body).to.include("layout:");
          expect(body).to.include("displayRegion");
          expect(body).to.include("TwoByTwo Split");
          expect(body).to.include("PictureInPicture");
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
