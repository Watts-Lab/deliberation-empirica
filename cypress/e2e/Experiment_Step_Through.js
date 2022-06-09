// Experiment.Step.Through.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test



//Step through each phase of the experiment with cypress
//TODO fix waiting for clock


describe("user perspective", () => {
    before(() => {
        //create and start batch
        cy.clearLocalStorage();
        cy.visit('http://localhost:3000/admin/');
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("cypress1");
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
        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);

        //TODO should be new consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.contains("Enter your Player Identifier");
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

        
        // cy.get('button').contains("Next").click();
        // cy.get('input').click().type("name");
        // cy.get('button').contains('Next').click();
        // cy.get('input[type="checkbox"]').as('checkboxes');
        // cy.get('@checkboxes').eq(0).check();
        // cy.get('@checkboxes').eq(0).should('have.attr', 'checked');
        // cy.get('@checkboxes').eq(0).as('checkbox').expect(checkbox[0].checked).to.equal(true);
        // cy.get('@checkboxes').eq(1).check();
        // cy.get('@checkboxes').eq(2).should('have.attr', 'checked');
        // cy.get('@checkboxes').eq(2).check();
        // cy.get('@checkboxes').eq(2).should('have.attr', 'checked');
        // cy.get('@checkboxes').eq(3).check();
        // cy.get('@checkboxes').eq(3).should('have.attr', 'checked');
        // cy.get('@checkboxes').eq(4).check();
        // cy.get('@checkboxes').eq(4).should('have.attr', 'checked');
        // cy.get('@checkboxes').eq(5).check();
        // cy.get('@checkboxes').eq(5).should('have.attr', 'checked');
        // cy.get('@checkboxes').eq(6).check();
        // cy.get('@checkboxes').eq(6).should('have.attr', 'checked');
        // cy.get('@checkboxes').each(checkbox => {
        //     expect(checkbox[0].checked).to.equal(true)
        // });
        // cy.get('@checkboxes').eq(0).expect(checkbox => {expect(checkbox.checked).to.equal(true)})
        // cy.get('input[type="checkbox"]').eq(1).as('checkboxes').check();
        // cy.get('@checkboxes').expect(checkbox[0].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[1].checked).to.equal(true);
        // cy.get('input[type="checkbox"]').eq(2).as('checkboxes').check();
        // cy.get('@checkboxes').expect(checkbox[0].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[1].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[2].checked).to.equal(true);
        // cy.get('input[type="checkbox"]').eq(3).as('checkboxes').check();
        // cy.get('@checkboxes').expect(checkbox[0].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[1].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[2].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[3].checked).to.equal(true);
        // cy.get('input[type="checkbox"]').eq(4).as('checkboxes').check();
        // cy.get('@checkboxes').expect(checkbox[0].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[1].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[2].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[3].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[4].checked).to.equal(true);
        // cy.get('input[type="checkbox"]').eq(5).as('checkboxes').check();
        // cy.get('@checkboxes').expect(checkbox[0].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[1].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[2].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[3].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[4].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[5].checked).to.equal(true);
        // cy.get('input[type="checkbox"]').eq(6).as('checkboxes').check();
        // cy.get('@checkboxes').expect(checkbox[0].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[1].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[2].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[3].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[4].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[5].checked).to.equal(true);
        // cy.get('@checkboxes').expect(checkbox[6].checked).to.equal(true);


        // cy.contains(" My camera and microphone are enabled.").click();
        // cy.wait(100);
        // cy.contains(" I can see my full face in the video window."). click();
        // cy.wait(100);
        // cy.contains(" (i.e. a diploma on the wall, the name of an employer).").click();
        // cy.wait(100);
        // cy.contains(" My background doesn't reveal other personal information I am not comfortable sharing.").click();
        // cy.wait(100);
        // cy.contains(" I am in a safe place to engage in a discussion.").click();
        // cy.wait(100);
        // cy.contains(" I am in a space where I can speak freely without bothering other people.").click();
        // cy.wait(100);
        // cy.contains(" I will not be interrupted").click();
        // cy.get('button').contains("Next").click(); 

        // Discussion
        cy.get('iframe')
        // cy.contains("Your deliberation topic is:");
        // cy.contains("Join meeting");
        cy.get('input').click({force: true});

        // Exit Survey
        cy.contains("On a scale of zero to ten, how likely are you to recommend our product to a friend or colleague?");
        cy.contains("5").click();
        cy.contains("What do you miss and what was disappointing in your experience with us?");
        cy.get('textarea').type("NA");
        cy.get("input[value='Complete']").click();

        // Finished screen
        cy.contains("Finished");
        
    });

})