// Experiment.Step.Through.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test



//Step through each phase of the experiment with cypress

//TODO test jitsu rendering
//TODO fix waiting for clock


describe("user perspective", () => {
    before(() => {
        //create and start batch
        cy.clearLocalStorage();
        cy.visit('http://localhost:3000/admin/');
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("Solo");
        //TODO set discussion duration to 1 second in treatment perameters
        cy.get('form').submit();
        cy.get('button').contains(" Start").click();
    })

    after(() => {
        cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});
    });
    
    it("walkthrough", () => {
        //clear();
        cy.visit('http://localhost:3000/');
        //consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type('cy');
        cy.get('button').last().click();

        // Instruction one
        cy.contains("Instruction One");
        cy.get('button').last().click({force: true});

        // Discussion
        // change to desired question
        cy.contains("Should our lab meetings feature cake, or pie?");
        cy.wait(20000);
        // const now = new Date();
        // cy.clock(now);
        // //change to number of milliseconds in timer
        // cy.tick(100000);
        cy.contains("Bonus");
        cy.contains("Exit Survey");
        cy.contains("Please answer the following short survey. You do not have to provide any information you feel uncomfortable with.");
        cy.contains("Age");
        cy.contains("Gender");
        cy.get("input").first().click().type("20");
        cy.get("input").eq(2).click().type("male");
        cy.contains("Highest Education");
        cy.contains("High School").click();
        cy.contains("US Bachelor's Degree");
        cy.contains("Master's or higher");
        cy.contains("Other");
        cy.contains("How would you describe your strength in the game?");
        cy.contains("Do you feel the pay was fair?");
        cy.contains("Feedback, including problems you encountered.");
        cy.get('textarea').eq(0).click().type("high");
        cy.get('textarea').eq(1).click().type("yes");
        cy.get('textarea').eq(2).click().type("NA");
        cy.contains("Submit").click();

        //finished screen
        cy.contains("Finished");
        cy.contains("Thank you for participating");

        //reset
        cy.contains("Reset Current Session").click({force: true});
        
        
    });

})