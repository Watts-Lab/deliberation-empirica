const expectedJSON = {
    "nps_score":8,
    "passive_experience": "I don't know but I like 8",
    "disappointed_experience": "Discussion too short",
};

describe('Test that survey data saves correctly', () => {
    before(() => {
        cy.clearLocalStorage();
        cy.visit('htpp://localhost:3000/admin/');
        cy.get('button').contains('New Batch').click();
        cy.get('button').contains('Simple').click();
        cy.get('select').first().select('1 player 10 second');
        cy.get('button').contains('Create').click();
        cy.get('button').contains(' Start').click();
    })

    after(() => {
        cy.exec('cd .. && cd .empirica/local && rm tajriba.json', {failOnNonZeroExit: false});
    })

    it('Test Survey with ExampleSurvey.json', () => {
        cy.clock();
        cy.visit('http://localhost:3000/?playerKey=1682370811758');
        cy.get('button').contains('AGREE').click();
        cy.get('input').type('abcdefg');
        cy.get('button').contains('Enter').click();
        cy.get('button').contains('Next').click();
        cy.tick(10000);
        cy.get('[type="radio"]').eq(8).check();
        cy.get('textarea[aria-label="What is the primary reason for your score"]').type("I don't know but I like 8");
        cy.get('textarea[aria-label="What do you miss and what was disappointing in your experience with us?"]').type('Discussion too short');
        cy.get('button').contains('Complete').click();
        // temporary solution with testing existence in tajriba.json
        cy.readFile('../.empirica/tajriba.json').then(data => {
            expect(Object.values(data).includes(JSON.stringify(expectedJSON))).to.be.true;
        });
    })
})