const expectedJSON = {};

// In theory this should work, waiting for Cypress set-up to be merged to main before actually testing and verifying that this works
describe('Test that survey data saves correctly', () => {
    it('Test Survey with ExampleSurvey.json', () => {
        cy.clock();
        cy.visit('http://localhost:3000');
        cy.get('button').contains('AGREE').click();
        cy.get('input').type('abcdefg');
        cy.get('button').contains('Next').click();
        cy.tick(20000);
        cy.get('[type="radio"]').eq(8).check();
        cy.get('textarea[aria-label="What is the primary reason for your score"]').type("I don't know but I like 8");
        cy.get('textarea[aria-label="What do you miss and what was disappointing in your experience with us?"]').type('Discussion too short');
        cy.get('button').contains('Complete').click();
        // need to find out where is player.json being stored
        cy.readFile('figure out filePath for player.json').its('playerId').should('deep.eq', expectedJSON);
    })
})