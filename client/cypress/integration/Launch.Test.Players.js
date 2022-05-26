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
        cy.get('select').select("2 players 2 seconds");
        cy.get('form').submit();
        cy.get('button').contains(" Start").click();
    })

    after(() => {
        cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});
    });

    it("first then second", () => {
        const bob = 'http://localhost:3000/?playerKey=bob';
        const alice = 'http://localhost:3000/?playerKey=alice'

        cy.visit(bob);
        //consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();
        // Login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type('bob');
        cy.get('button').contains("Enter").click();        
        // Instruction one
        cy.contains("Instruction One");
        cy.get('button').contains("Next").click({force: true});    
        cy.contains("Game loading");
        //cy.get('button').contains("New Player").click({force: true});

        const player2 = 'http://localhost:3000/?playerKey=player2'
        cy.visit(player2);
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();
        // Login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type('player2');
        cy.get('button').contains("Enter").click();        
        // Instruction one
        cy.contains("Instruction One");
        cy.get('button').contains("Next").click({force: true});
        cy.contains("Your deliberation topic is:");
        cy.contains("Join meeting");
        cy.wait(2000);
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
        


    })

    // it("launching two test players", () => {
    //     const bob = 'http://localhost:3000/?playerKey=bob';
    //     const alice = 'http://localhost:3000/?playerKey=alice'
    //     //BOB
    //     cy.visit(bob);
    //     //consent
    //     cy.contains("Do you consent to participate in this experiment?");
    //     cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
    //     cy.get('button').contains('I AGREE').click();
    //     // Login
    //     cy.contains("Enter your Player Identifier");
    //     cy.get('input').click().type('bob');
    //     cy.get('button').contains("Enter").click();

    //     //ALICE
    //     cy.visit(alice);
    //     //consent
    //     cy.contains("Do you consent to participate in this experiment?");
    //     cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
    //     cy.get('button').contains('I AGREE').click();
    //     // Login
    //     cy.contains("Enter your Player Identifier");
    //     cy.get('input').click().type('alice');
    //     cy.get('button').contains("Enter").click();
        

    //     cy.visit(bob);
    //     // Instruction one
    //     cy.contains("Instruction One");
    //     cy.get('button').contains("Next").click({force: true});

    //     cy.visit(alice);
    //     // Instruction one
    //     cy.contains("Instruction One");
    //     cy.get('button').contains("Next").click({force: true});

    //     // BOB discussion
    //     cy.visit(bob);
    //     cy.contains("Your deliberation topic is:");
    //     cy.contains("Join meeting");

    //     // ALICE discussion
    //     cy.visit(alice);
    //     cy.contains("Instruction One");
    //     cy.contains("Your deliberation topic is:");
    //     cy.contains("Join meeting");

    //     //ALICE Exit
    //     cy.contains("Bonus");
    //     cy.contains("Exit Survey");
    //     cy.contains("Please answer the following short survey. You do not have to provide any information you feel uncomfortable with.");
    //     cy.contains("Age");
    //     cy.contains("Gender");
    //     cy.get("input").first().click().type("20");
    //     cy.get("input").eq(2).click().type("male");
    //     cy.contains("Highest Education");
    //     cy.contains("High School").click();
    //     cy.contains("US Bachelor's Degree");
    //     cy.contains("Master's or higher");
    //     cy.contains("Other");
    //     cy.contains("How would you describe your strength in the game?");
    //     cy.contains("Do you feel the pay was fair?");
    //     cy.contains("Feedback, including problems you encountered.");
    //     cy.get('textarea').eq(0).click().type("high");
    //     cy.get('textarea').eq(1).click().type("yes");
    //     cy.get('textarea').eq(2).click().type("NA");
    //     cy.contains("Submit").click();

    //     //BOB Exit
    //     cy.visit(bob);
    //     cy.contains("Bonus");
    //     cy.contains("Exit Survey");
    //     cy.contains("Please answer the following short survey. You do not have to provide any information you feel uncomfortable with.");
    //     cy.contains("Age");
    //     cy.contains("Gender");
    //     cy.get("input").first().click().type("20");
    //     cy.get("input").eq(2).click().type("male");
    //     cy.contains("Highest Education");
    //     cy.contains("High School").click();
    //     cy.contains("US Bachelor's Degree");
    //     cy.contains("Master's or higher");
    //     cy.contains("Other");
    //     cy.contains("How would you describe your strength in the game?");
    //     cy.contains("Do you feel the pay was fair?");
    //     cy.contains("Feedback, including problems you encountered.");
    //     cy.get('textarea').eq(0).click().type("high");
    //     cy.get('textarea').eq(1).click().type("yes");
    //     cy.get('textarea').eq(2).click().type("NA");
    //     cy.contains("Submit").click();
    //     //BOB finished
    //     cy.contains("Finished");
    //     cy.contains("Thank you for participating");

    //     //ALICE finished
    //     cy.visit(alice);
    //     cy.contains("Finished");
    //     cy.contains("Thank you for participating");

    // });
});
