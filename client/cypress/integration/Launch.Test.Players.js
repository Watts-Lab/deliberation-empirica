// Launch.Test.Players.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

//Launch multiple test players with cypress

describe("multiple test players", () => {
    before(() => {
        //create and start batch
        cy.clearLocalStorage();
        cy.visit('http://localhost:3000/admin/');
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("Two Players");
        //TODO set discussion duration to 1 second in treatment perameters
        cy.get('form').submit();
        cy.get('button').contains(" Start").click();
    })

    after(() => {
        cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});
    });

    it("launching two test players", () => {
        //ALICE
        cy.visit('http://localhost:3000/?playerKey=alice');
        //consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type('alice');
        cy.get('button').last().click();

        // Instruction one
        cy.contains("Instruction One");
        cy.get('button').last().click({force: true});

        //TODO game loading

        //BOB
        cy.visit('http://localhost:3000/?playerKey=bob');
        //consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type('bob');
        cy.get('button').last().click();

        // Instruction one
        cy.contains("Instruction One");
        cy.get('button').last().click({force: true});

        //TODO discussion
        //switch to alice
        //discussion
    });
});
