import dayjs from 'dayjs'

// Experiment.Step.Through.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test



//Step through each phase of the experiment with cypress
//TODO fix waiting for clock

const duration = require('dayjs/plugin/duration')
dayjs.extend(duration)

describe("user perspective", () => {
    before(() => {
        //create and start batch
        cy.clearLocalStorage();
        cy.visit('http://localhost:3000/admin/');
        cy.wait(4000)
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("1 player 6 seconds");
        //TODO set discussion duration to 1 second in treatment perameters
        cy.contains('game', { timeout: 500 }).should('be.visible');
        cy.get('button[type="submit"]').click();
        cy.waitUntil(() => cy.get('form').should('not.be.visible'));
        //cy.get('form', { timeout: 500 }).should('not.be.visible');
        cy.get('button').contains(" Start").click();
    })

    // after(() => {
    //     cy.contains("Reset Current Session").click({force: true});
    //     //cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});
    // });
    
    it("walkthrough", () => {
        //clear();
        let start; 
        let end; 
        let difference; 
        let payment;

        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);

        //TODO should be new consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.contains("Enter your Player Identifier").then(() => {
            start = dayjs();
        });
        cy.get('input').click().type(randomPlayerKey2);
        cy.get('button').contains("Enter").click();
        cy.wait(100);  

        //Instructions 
        cy.contains("About this study:"); 
        cy.get('button').contains("Next").click({force: true});

        // Name Input
        cy.get('input').click().type(randomPlayerKey2);
        cy.get('button').contains("Next").click();  

        // Video check
        cy.get('input[id="invisible-button"').click({force: true});
        // cy.wait(3000);
        // cy.contains(" My camera and microphone are enabled.").click();
        // cy.contains(" I can see my full face in the video window."). click();
        // cy.contains(" (i.e. a diploma on the wall, the name of an employer).").click();
        // cy.contains(" My background doesn't reveal other personal information I am not comfortable sharing.").click();
        // cy.contains(" I am in a safe place to engage in a discussion.").click();
        // cy.contains(" I am in a space where I can speak freely without bothering other people.").click();
        // cy.contains(" I will not be interrupted").click();
        // cy.get('button').contains("Next").click(); 
        
        // Understanding check
        cy.contains("Answer the following questions to confirm your understanding of the instructions.");
        cy.get('label').contains("Partcipate in a discussion with other participants").click();
        cy.get('label').contains("Write about your group's discussion").click();
        cy.get('label').contains("To be anonmously published in academic venues.").click();
        cy.get('label').contains("To disclose to other participants during the session").click();
        cy.get('label').contains("For quality control").click();
        cy.get('label').contains("To analyze for behavioral patterns to support our research.").click();
        cy.get('label').contains("To share with select researchers under confidentiality agreements.").click();
        cy.get('label').contains("15-35 minutes").click();
        cy.get('button').contains("Next").click();

        // Discussion
        cy.get('iframe')
        // cy.contains("Your deliberation topic is:");
        // cy.contains("Join meeting");
        cy.get('input').click({force: true}).then(() => {
            end = dayjs();
            cy.log(`start: ${start}`)
            cy.log(`end: ${end}`)
            cy.log(`diff: ${dayjs.duration(end.diff(start)).$ms}`)
            difference = dayjs.duration(end.diff(start)).$ms
            payment = (((difference / 3600000) * 15).toFixed(2))
            cy.contains("You have received $" + payment + " for participating in our experiment.")
        })

        cy.contains("On a scale of zero to ten, how likely are you to recommend our product to a friend or colleague?");
        cy.wait(3000)
        cy.contains("5").click();
        cy.contains("What do you miss and what was disappointing in your experience with us?");
        cy.get('textarea').type("NA")
        
        cy.get("input[value='Complete']").click();
        cy.contains("Finished");
    });
});