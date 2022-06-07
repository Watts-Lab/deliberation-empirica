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
        cy.get('select').select("1 player 15 min");
        cy.get('form').submit();
        cy.get('button').contains(" Start").click();
        //go to test on local host
        cy.visit('http://localhost:3000/?playerKey=testAudioScreenLaunchCyp');
         
    })
})

beforeEach(() => {
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
})

it ("test video and audio", () => {
    //admin screen renders properly
    cy.visit('http://localhost:3000/admin/');
    cy.contains("Batches");
    //create new batch
    cy.get("button").contains('New Batch').click();
    cy.get('select').select("1 player 15 min");
    cy.get('form').submit();
    cy.get('button').contains(" Start").click();
    //go to test on local host
    cy.visit('http://localhost:3000/?playerKey=testAudioScreenLaunchCyp');
    cy.contains("Do you consent to participate in this experiment?");
    cy.get("button").contains('I AGREE').click()
    //login
    cy.contains("Enter your Player Identifier");
    cy.get('input').click().type('randomName123456');
    cy.get('button').contains("Enter").click();   
    cy.get('button').contains("Next").click();   
    //now should be on video and audio screen
    cy.contains(" My camera and microphone are enabled.");
    cy.contains(" I can see my full face in the video window.");
    cy.contains(" Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer).");
    cy.contains(" My background doesn't reveal other personal information I am not ready to share with other participants.");
    cy.contains(" I am in a safe place to engage in a discussion.");
    cy.contains(" I will not be interrupted.");
    cy.contains(" I am in a space where I can speak freely without bothering other people.");
    //should not be able to click next without checking, making sure this doesnt change screen
    cy.get('button').contains("Next").click(); 
    //should be able to go to next after checking all
    cy.get("label").contains(" My camera and microphone are enabled.").click();
    cy.get("label").contains(" I can see my full face in the video window."). click();
    cy.get("label").contains(" Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer).").click();
    cy.get("label").contains(" My background doesn't reveal other personal information I am not ready to share with other participants.").click();
    cy.get("label").contains(" I am in a safe place to engage in a discussion.").click();
    cy.get("label").contains(" I am in a space where I can speak freely without bothering other people.").click();
    cy.get('button').contains("Next").click(); 
    //checking next screen
    cy.get('iframe')
    cy.wait(9000);
    //goes to exit survey
    cy.contains("On a scale of zero to ten, how likely are you to recommend our product to a friend or colleague?");
    
    


})
