/* eslint-disable no-restricted-syntax */

const configJson = `{
  "batchName": "cytest_scroll_indicator",
  "cdn": "test",
  "treatmentFile": "projects/example/cypress.treatments.yaml",
  "customIdInstructions": "none",
  "platformConsent": "US",
  "consentAddendum": "none",
  "checkAudio": false,
  "checkVideo": false,
  "introSequence": "none",
  "treatments": [
    "cypress_scroll_indicator"
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

describe(
    "Scroll Indicator Feature",
    { retries: { runMode: 2, openMode: 0 } },
    () => {
        beforeEach(() => {
            cy.empiricaClearBatches();

            cy.empiricaCreateCustomBatch(configJson, {});
            cy.wait(3000);
            cy.empiricaStartBatch(1);
        });

        it("shows scroll indicator when conditional content appears below viewport", () => {
            const playerKey = `testplayer_scroll_${Math.floor(Math.random() * 1e13)}`;
            const playerKeys = [playerKey];

            cy.empiricaSetupWindow({ playerKeys });
            cy.interceptIpApis();

            // Complete intro steps (no intro sequence, so just basic steps)
            cy.stepIntro(playerKey, {});
            cy.stepConsent(playerKey);
            cy.stepAttentionCheck(playerKey);
            cy.stepVideoCheck(playerKey, {
                setupCamera: false,
                setupMicrophone: false,
            });
            cy.stepNickname(playerKey);

            cy.waitForGameLoad(playerKey);

            // Set viewport to a smaller size to ensure content goes below fold
            cy.viewport(1024, 400);

            // Initial content should be visible (markdown.md)
            cy.get(`[data-player-id="${playerKey}"]`).contains("Markdown Table");

            // Wait for conditional content to appear (displayTime: 3 seconds)
            cy.wait(4000);

            // Conditional content should now be visible
            // Either auto-scrolled (if at bottom) or indicator shown (if not)
            cy.get(`[data-player-id="${playerKey}"]`).contains("TestDisplay00");

            // Complete the stage
            cy.submitPlayers(playerKeys);
        });

        it("auto-scrolls when at bottom and new content appears", () => {
            const playerKey = `testplayer_autoscroll_${Math.floor(
                Math.random() * 1e13
            )}`;
            const playerKeys = [playerKey];

            cy.empiricaSetupWindow({ playerKeys });
            cy.interceptIpApis();

            // Complete intro steps
            cy.stepIntro(playerKey, {});
            cy.stepConsent(playerKey);
            cy.stepAttentionCheck(playerKey);
            cy.stepVideoCheck(playerKey, {
                setupCamera: false,
                setupMicrophone: false,
            });
            cy.stepNickname(playerKey);

            cy.waitForGameLoad(playerKey);

            // Set smaller viewport
            cy.viewport(1024, 400);

            // Wait for conditional content
            cy.wait(4000);

            // The conditional content should be visible
            cy.get(`[data-player-id="${playerKey}"]`)
                .contains("TestDisplay00")
                .should("exist");

            // Complete the stage
            cy.submitPlayers(playerKeys);
        });
    }
);
