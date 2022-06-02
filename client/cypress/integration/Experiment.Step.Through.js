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
        cy.get('select').select("1 player 6 seconds");
        //TODO set discussion duration to 1 second in treatment perameters
        cy.get('form').submit();
        cy.get('button').contains(" Start").click();
    })

    after(() => {
        cy.contains("Reset Current Session").click({force: true});
        cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});
    });
    
    it("walkthrough", () => {
        //clear();
        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);
        //consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type('cy');
        cy.get('button').contains("Enter").click();
        cy.wait(100);

        cy.contains("About this study:");
        cy.get('button').contains("Next").click();
        cy.contains("Answer the following questions to confirm your understanding of the instructions.");
        cy.get('label').contains("Partcipate in a discussion with other participants").click();
        cy.get('label').contains("Write about your group's discussion").click();
        cy.get('label').contains("To be anonmously published in academic venues.").click();
        cy.get('label').contains("To disclose to other participants during the session").click();
        cy.get('label').contains("To analyze for behavioral patterns to support our research.").click();
        cy.get('label').contains("To share with select researchers under confidentiality agreements.").click();
        cy.get('label').contains("15-35 minutes").click();
        cy.get('button').contains("Next").click();

        // Discussion
        cy.get('iframe')
        // cy.contains("Your deliberation topic is:");
        // cy.contains("Join meeting");
        cy.wait(6000);

        //Exit Survey
        cy.contains("On a scale of zero to ten, how likely are you to recommend our product to a friend or colleague?");
        cy.contains("5").click();
        cy.contains("What do you miss and what was disappointing in your experience with us?");
        cy.get('#sq_103i').click().type("NA");
        cy.get("#sv-nav-complete > div > input").click();


        //finished screen
        cy.contains("Thank you for your feedback.");
        
        
    });

})