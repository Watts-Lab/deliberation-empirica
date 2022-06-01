// Experiment.Step.Through.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

// Launch a game using cypress in the admin console, or Empirica API and make it
//video test screen

it ("test video and audio", () => {
    //admin screen renders properly
    cy.visit('http://localhost:3000/admin/');
    cy.contains("Batches");
    //create new batch
    cy.get("button").contains('New Batch').click();
    cy.get('select').select("1 player 15 minutes");
    cy.get('form').submit();
    cy.get('button').contains(" Start").click();
    //go to test on local host
    cy.visit('http://localhost:3000/?playerKey=testAudioScreenLaunch');
    cy.contains("Do you consent to participate in this experiment?");
    cy.get("button").contains('I AGREE').click()
    //login
    cy.contains("Enter your Player Identifier");
    cy.get('input').click().type('randomName12345');
    cy.get('button').contains("Enter").click();   
    //next screen
    cy.get('button').contains("Next").click(); 
    //now should be on video and audio screen
    cy.contains("Join meeting");
    cy.get('checkbox').contains(" My camera and microphone are enabled.");
    cy.get('checkbox').contains(" I can see my full face in the video window.");
    cy.get('checkbox').contains(" Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer).");
    cy.get('checkbox').contains(" My background doesn't reveal other personal information I am not ready to share with other participants.");
    cy.get('checkbox').contains(" I am in a safe place to engage in a discussion.");
    cy.get('checkbox').contains(" I will not be interrupted.");
    cy.get('checkbox').contains(" I am in a space where I can speak freely without bothering other people.");
    //should not be able to click without checking, making sure this doesnt change screen
    cy.get('button').contains("Next").click(); 
    //now clicking all of them and should change screens
    cy.contains("Join meeting");
    cy.get('checkbox').contains(" My camera and microphone are enabled.").click();
    cy.get('checkbox').contains(" I can see my full face in the video window.");
    cy.get('checkbox').contains(" Nothing in my background reveals my full name (i.e. a diploma on the wall, the name of an employer).").click();
    cy.get('checkbox').contains(" My background doesn't reveal other personal information I am not ready to share with other participants.").click();
    cy.get('checkbox').contains(" I am in a safe place to engage in a discussion.").click();
    cy.get('checkbox').contains(" I will not be interrupted.").click();
    cy.get('checkbox').contains(" I am in a space where I can speak freely without bothering other people.").click();
    cy.get('button').contains("Next").click(); 


})
