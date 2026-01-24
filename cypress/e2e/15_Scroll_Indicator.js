/* eslint-disable no-restricted-syntax */

const batchConfigFixture = require("../fixtures/mockCDN/test/scrollIndicator/test.config.json");

describe(
    "Scroll Indicator Feature",
    { retries: { runMode: 2, openMode: 0 } },
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

        it("shows scroll indicator when conditional content appears below viewport", () => {
            const playerKey = `testplayer_scroll_${Math.floor(Math.random() * 1e13)}`;
            const playerKeys = [playerKey];

            cy.empiricaSetupWindow({ playerKeys });
            cy.interceptIpApis();

            // Complete intro steps (no intro sequence)
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

            // Initial content should be visible
            cy.get(`[data-player-id="${playerKey}"]`).contains("Initial Content");

            // Wait for conditional content to appear (displayTime: 3 seconds)
            cy.wait(4000);

            // Conditional content should now be visible
            // Either auto-scrolled (if at bottom) or indicator shown (if not)
            cy.get(`[data-player-id="${playerKey}"]`).contains("Timed Content 1");

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
                .contains("Timed Content 1")
                .should("exist");

            // Complete the stage
            cy.submitPlayers(playerKeys);
        });
    }
);
