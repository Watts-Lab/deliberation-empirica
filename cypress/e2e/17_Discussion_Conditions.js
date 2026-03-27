describe(
  "Discussion Conditions",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "cytest_17_discussionConditions",
        "cdn": "test",
        "treatmentFile": "projects/example/cypress.treatments.yaml",
        "customIdInstructions": "none",
        "platformConsent": "US",
        "consentAddendum": "none",
        "debrief": "none",
        "checkAudio": false,
        "checkVideo": false,
        "introSequence": "none",
        "treatments": [
          "cypress_discussion_conditions"
        ],
        "payoffs": "equal",
        "knockdowns": "none",
        "dispatchWait": 1,
        "launchDate": "immediate",
        "centralPrereg": false,
        "preregRepos": [],
        "dataRepos": [],
        "videoStorage": "none",
        "exitCodes": "none"
      }`;

      cy.empiricaCreateCustomBatch(configJson, {});
      cy.wait(3000);
      cy.empiricaStartBatch(1);
    });

    it("shows or hides discussion based on conditions and position", () => {
      const playerKeys = [
        `discCond_A_${Math.floor(Math.random() * 1e13)}`,
        `discCond_B_${Math.floor(Math.random() * 1e13)}`,
      ];
      const hitId = "discussionConditionsHIT";

      cy.empiricaSetupWindow({ playerKeys, hitId });
      cy.interceptIpApis();

      // Intro steps
      playerKeys.forEach((playerKey) => {
        cy.stepIntro(playerKey);
      });

      playerKeys.forEach((playerKey) => {
        cy.stepConsent(playerKey);
        cy.stepAttentionCheck(playerKey);
        cy.stepVideoCheck(playerKey, {
          setupMicrophone: false,
          setupCamera: false,
        });
        cy.stepNickname(playerKey);
      });

      // Lobby
      playerKeys.forEach((playerKey) => {
        cy.waitForGameLoad(playerKey);
      });

      // ===== Stage 1: Setup Choice =====
      // Both players select "HTML" so the condition `equals HTML, position: all` will be true
      playerKeys.forEach((playerKey) => {
        cy.playerCanSee(playerKey, "Setup Choice");
        cy.get(
          `[data-player-id="${playerKey}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
        ).click();
      });
      cy.submitPlayers(playerKeys);

      // ===== Stage 2: Discussion Condition Met =====
      // Condition: prompt.setupChoice equals HTML (position: all) → TRUE
      // Discussion should be visible (two-column layout with text chat)
      playerKeys.forEach((playerKey) => {
        cy.playerCanSee(playerKey, "Discussion Condition Met");
        cy.get(`[data-player-id="${playerKey}"] [data-test="discussion"]`).should(
          "be.visible"
        );
        // The no-discussion single-column layout should NOT be present
        cy.get(
          `[data-player-id="${playerKey}"] [data-test="stageContent"]`
        ).should("not.exist");
      });

      // Verify text chat works
      cy.typeInChat(playerKeys[0], "Hello from player A");
      cy.get(`[data-player-id="${playerKeys[1]}"]`).contains(
        "Hello from player A"
      );

      cy.submitPlayers(playerKeys);

      // ===== Stage 3: Discussion Condition Not Met =====
      // Condition: prompt.setupChoice equals Markdown (position: all) → FALSE
      // Discussion should be hidden, single-column layout should render
      playerKeys.forEach((playerKey) => {
        cy.playerCanSee(playerKey, "Discussion Condition Not Met");
        // Discussion panel should NOT exist
        cy.get(
          `[data-player-id="${playerKey}"] [data-test="discussion"]`
        ).should("not.exist");
        // Single-column layout should be present
        cy.get(
          `[data-player-id="${playerKey}"] [data-test="stageContent"]`
        ).should("be.visible");
      });
      cy.submitPlayers(playerKeys);

      // ===== Stage 4: Discussion Position Hidden =====
      // hideFromPositions: [0, 1] hides from both players → single-column layout
      playerKeys.forEach((playerKey) => {
        cy.playerCanSee(playerKey, "Discussion Position Hidden");
        cy.get(
          `[data-player-id="${playerKey}"] [data-test="discussion"]`
        ).should("not.exist");
        cy.get(
          `[data-player-id="${playerKey}"] [data-test="stageContent"]`
        ).should("be.visible");
      });
      cy.submitPlayers(playerKeys);

      // Exit
      playerKeys.forEach((playerKey) => {
        cy.stepQCSurvey(playerKey);
      });
    });
  }
);
