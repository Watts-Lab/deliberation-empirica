// Experiment.Step.Through.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

// Launch a multiplayer test game using cypress in the admin console, or Empirica API

it ("multiplayer test game launch", () => {
    //admin screen renders properly
    cy.visit('http://localhost:3000/admin/');
    cy.contains("Batches");
    //create new batch
    cy.get("button").contains('New Batch').click();
    cy.get('select').select("cypress1");
    cy.contains('game', { timeout: 500 }).should('be.visible');
    cy.get('button[type="submit"]').click();
        cy.waitUntil(() => cy.get('form').should('not.be.visible'));
    cy.get('button').contains(" Start").click();
    //make sure test is running on localhost
    cy.visit('http://localhost:3000/?playerKey=multiplayerLaunch');
    cy.contains("Do you consent to participate in this experiment?");
    //end batch
    cy.visit('http://localhost:3000/admin/');
    cy.get('button').contains(" Stop").click();
    //cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});

})
