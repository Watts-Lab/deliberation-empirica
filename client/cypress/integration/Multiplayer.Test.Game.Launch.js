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
    cy.get("button").eq(1).click();
    cy.get('select').select("Two Players");
    cy.get('form').submit();
    cy.get('button').eq(2).click();
    //make sure test is running on localhost
    cy.visit('http://localhost:3000');
    cy.contains("Do you consent to participate in this experiment?");
    //end batch
    cy.visit('http://localhost:3000/admin/');
    cy.get('button').eq(-2).click();

})
