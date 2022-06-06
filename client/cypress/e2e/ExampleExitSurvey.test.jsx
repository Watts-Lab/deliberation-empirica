// const expectedJSON = {
//     "nps_score":8,
//     "passive_experience": "I don't know but I like 8",
//     "disappointed_experience": "Discussion too short",
// };
const expectedString = '\\"nps_score\\":8,\\"passive_experience\\":\\"I don\'t know but I like 8\\",\\"disappointed_experience\\":\\"Discussion too short\\"';

describe('Test that survey data saves correctly', () => {
    before(() => {
        cy.clearLocalStorage();
        cy.visit('http://localhost:3000/admin/');
        cy.get('button').contains('New Batch').click();
        cy.get('button').contains('Simple').click();
        cy.get('select').first().select('1 player 6 seconds');
        cy.get('form').submit();
        cy.get('button').contains(' Start').click();
    })

    // after(() => {
    //     cy.exec('cd .. && cd .empirica/local && rm tajriba.json', {failOnNonZeroExit: false});
    // })

    it('Test Survey with ExampleSurvey.json', () => {
        //const now = new Date();
        //cy.clock(now);
        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);
        // cy.visit('http://localhost:3000/?playerKey=1682370811758');
        cy.contains("Do you consent to participate in this experiment?");
        cy.get('button').contains('I AGREE').click();
        cy.get('input').type('abcdefg');
        cy.get('button').contains('Enter').click();
        cy.wait(100);
        cy.get('button').contains('Next').click();
        //cy.tick(10000);
        cy.wait(6000);
        cy.get('[type="radio"]').eq(8).check({force: true});
        cy.get('textarea[aria-label="What is the primary reason for your score?"]').type("I don't know but I like 8");
        cy.get('textarea[aria-label="What do you miss and what was disappointing in your experience with us?"]').type('Discussion too short');
        cy.get('input[value="Complete"]').click();
        // temporary solution with testing existence in tajriba.json
        cy.exec('cd .. && cd .empirica/local && mv tajriba.json tajriba.txt');
        // cy.readFile('../.empirica/local/tajriba.txt').then(data => {
        //     expect(data.includes(JSON.stringify(expectedJSON))).to.be.true;
        // });
        cy.readFile('../.empirica/local/tajriba.txt').then(data => {
            console.log(data);
            expect(data.includes(expectedString)).to.be.true;
        });

        cy.exec('cd .. && cd .empirica/local && rm tajriba.txt', {failOnNonZeroExit: false});
    })
})