// Experiment.Step.Through.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

//Step through each phase of the experiment with cypress

describe("user perspective", () => {
    before(() => {
        //create and start batch
        cy.visit('http://localhost:3000/admin/');
        cy.get("button").eq(1).click();
        cy.get('select').select("Solo");
        cy.get('form').submit();
        //TODO make sure this is clicking the one just created
        cy.get('button').eq(38).click();
    })
    
    it("consent", () => {
        cy.visit('http://localhost:3000/');
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE');
    });
})