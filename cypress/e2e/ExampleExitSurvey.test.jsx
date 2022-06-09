// const expectedJSON = {
//     "nps_score":8,
//     "passive_experience": "I don't know but I like 8",
//     "disappointed_experience": "Discussion too short",
// };


describe('Test that survey data saves correctly', () => {
    before(() => {
        cy.clearLocalStorage();
        cy.visit('http://localhost:3000/admin/');
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("1 player 6 seconds");
        //TODO set discussion duration to 1 second in treatment perameters
        cy.contains('game', { timeout: 500 }).should('be.visible');
        //cy.get('button').contains("Create").click()
        cy.get('button[type="submit"]').click();
        cy.waitUntil(() => cy.get('form').should('not.be.visible'));
        cy.wait
        cy.get('button').contains(" Start").click();
    })

    // after(() => {
    //     cy.exec('cd .. && cd .empirica/local && rm tajriba.json', {failOnNonZeroExit: false});
    // })

    it('Test Survey with ExampleSurvey.json', () => {
        //const now = new Date();
        //cy.clock(now);
        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        const expectedString = '\\"nps_score\\":8,\\"passive_experience\\":\\"I don\'t know but I like 8\\",\\"disappointed_experience\\":\\"Discussion too short\\"';
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);
        // cy.visit('http://localhost:3000/?playerKey=1682370811758');
        cy.contains("Do you consent to participate in this experiment?");
        cy.get('button').contains('I AGREE').click();
        cy.get('input').type(randomPlayerKey2);
        cy.get('button').contains('Enter').click();
        cy.wait(100);
        cy.get('button').contains('Next').click();
        cy.get('input').click().type(randomPlayerKey2);
        cy.get('button').contains("Next").click();
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
        //cy.tick(10000);
        cy.contains("On a scale of zero to ten, how likely are you to recommend our product to a friend or colleague?");
        cy.contains("5").click();
        cy.contains("What do you miss and what was disappointing in your experience with us?");
        cy.get('textarea').type("NA");
        cy.get("input[value='Complete']").click();
        // cy.get('input').click({force: true});
        // cy.contains('8').click({force: true});
        // cy.get('textarea[aria-label="What is the primary reason for your score?"]').type(`score${randomPlayerKey2}`);
        // cy.get('textarea[aria-label="What do you miss and what was disappointing in your experience with us?"]').type(`discussion${randomPlayerKey2}`);
        // cy.get('input[value="Complete"]').click();
        // temporary solution with testing existence in tajriba.json
        cy.exec('cd .. && cd .empirica/local && mv tajriba.json tajriba.txt');
        // cy.readFile('../.empirica/local/tajriba.txt').then(data => {
        //     expect(data.includes(JSON.stringify(expectedJSON))).to.be.true;
        // });
        cy.readFile('../.empirica/local/tajriba.txt').then(data => {
            console.log(data);
            //expect(data.includes('score' + randomPlayerKey2)).to.be.true;
            expect(data.includes(`discussion${randomPlayerKey2}`)).to.be.true;
        });

        cy.exec('cd .. && cd .empirica/local && mv tajriba.txt tajriba.json');

    })
})