// Experiment.Step.Through.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

// Launch a game using cypress in the admin console, or Empirica API and make it
//video test screen

describe("test video and audio check", () => {
    before(() => {
        cy.visit('http://localhost:3000/admin/');
        cy.contains("Batches");
        //create new batch
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("cypress1");
        cy.contains('game', { timeout: 500 }).should('be.visible');
        cy.get('button[type="submit"]').click();
        cy.waitUntil(() => cy.get('form').should('not.be.visible'));
        //cy.contains('Treatments').should('not.be.visible');
        cy.get('button').contains(" Start").click();
    })

    after(() => {
        cy.visit('http://localhost:3000/admin/');
        cy.get('button').contains(" Stop").click();
    })
    
    it ("test video and audio", () => {
        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);
        cy.contains("Do you consent to participate in this experiment?");
        cy.get("button").contains('I AGREE').click()
        //login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type(randomPlayerKey2);
        cy.get('button').contains("Enter").click();   
        cy.get('button').contains("Next").click(); 
        cy.get('input').click().type(randomPlayerKey2);
        cy.get('button').contains("Next").click();  
        cy.wait(3000);
        //now should be on video and audio screen
        //should not be able to click next without checking, making sure this doesnt change screen
        cy.get('button').contains("Next").click(); 
        //should be able to go to next after checking all
        cy.contains(" My camera and microphone are enabled.").click();
        cy.contains(" I can see my full face in the video window."). click();
        cy.contains(" (i.e. a diploma on the wall, the name of an employer).").click();
        cy.contains(" My background doesn't reveal other personal information I am not comfortable sharing.").click();
        cy.contains(" I am in a safe place to engage in a discussion.").click();
        cy.contains(" I am in a space where I can speak freely without bothering other people.").click();
        cy.contains(" I will not be interrupted").click();
        cy.get('button').contains("Next").click(); 
        //checking next screen
        cy.contains('Eat a dishwasher');
    })
})
