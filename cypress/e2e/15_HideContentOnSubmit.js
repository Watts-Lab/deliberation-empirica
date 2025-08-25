// Test for hideContentOnSubmit functionality

describe("hideContentOnSubmit Feature Test", { retries: { runMode: 2, openMode: 0 } }, () => {
  
  beforeEach(() => {
    cy.empiricaClearBatches();
    cy.exec("truncate -s 0 ../data/empirica.log");

    const configJson = `{
      "batchName": "cytest_hideContentOnSubmit",
      "cdn": "test", 
      "treatmentFile": "projects/example/cypress.treatments.yaml",
      "customIdInstructions": "none",
      "platformConsent": "US",
      "consentAddendum": "none",
      "checkAudio": false,
      "checkVideo": false,
      "introSequence": "none",
      "treatments": [
        "cypress_hideContentOnSubmit_test"
      ],
      "payoffs": "equal",
      "knockdowns": "none", 
      "dispatchWait": 1,
      "launchDate": "immediate",
      "centralPrereg": false,
      "preregRepos": [],
      "dataRepos": [],
      "videoStorage": {
        "bucket": "deliberation-lab-recordings-test",
        "region": "us-east-1"
      },
      "exitCodes": {
        "complete": "cypressComplete",
        "error": "cypressError",
        "lobbyTimeout": "cypressLobbyTimeout",
        "failedEquipmentCheck": "cypressFailedEquipmentCheck"
      }
    }`;

    cy.empiricaCreateBatch(configJson);
    cy.empiricaStartBatch("cytest_hideContentOnSubmit");
  });

  it("should hide content when hideContentOnSubmit is true, and keep content when false", () => {
    // Start with two players
    cy.stepPlayerStart("playerA", "MyId");
    cy.stepPlayerStart("playerB", "MyId");

    cy.stepJoin("playerA");
    cy.stepJoin("playerB");

    // Stage 1: Test hideContentOnSubmit: true (should hide content)
    cy.get('[test-player-id="playerA"]').contains("Test Hide Content True (Default)");
    cy.get('[test-player-id="playerA"]').contains("Submit and Hide Content");
    cy.get('[test-player-id="playerA"] [data-test="submitButton"]').click();
    
    // Content should be hidden after submit
    cy.get('[test-player-id="playerA"]').should('not.contain', 'HTML');
    cy.get('[test-player-id="playerA"]').contains("Please wait for other participant(s).");
    
    // Submit second player to advance
    cy.get('[test-player-id="playerB"] [data-test="submitButton"]').click();
    
    // Stage 2: Test hideContentOnSubmit: false (should keep content)
    cy.get('[test-player-id="playerA"]').contains("Test Hide Content False");
    cy.get('[test-player-id="playerA"]').contains("Submit but Keep Content");
    cy.get('[test-player-id="playerA"] [data-test="submitButton"]').click();
    
    // Content should still be visible after submit (this is the new behavior)
    cy.get('[test-player-id="playerA"]').should('contain', 'Rainbow');
    cy.get('[test-player-id="playerA"]').should('not.contain', 'Please wait for other participant(s).');
    
    // Submit second player to advance
    cy.get('[test-player-id="playerB"] [data-test="submitButton"]').click();
    
    // Stage 3: Test default behavior (should hide content)
    cy.get('[test-player-id="playerA"]').contains("Test Hide Content Default");
    cy.get('[test-player-id="playerA"]').contains("Submit (Default Behavior)");
    cy.get('[test-player-id="playerA"] [data-test="submitButton"]').click();
    
    // Content should be hidden (default behavior)
    cy.get('[test-player-id="playerA"]').should('not.contain', 'Wizard');
    cy.get('[test-player-id="playerA"]').contains("Please wait for other participant(s).");
  });
});