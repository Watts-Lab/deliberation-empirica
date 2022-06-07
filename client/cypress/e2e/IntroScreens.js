

describe("intro screen tests", () => {
    before(() => {
        cy.visit('http://localhost:3000/admin/');
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("2 players 6 seconds");
        cy.get('form').submit();
        cy.get('button').contains(" Start").click();
    })

    beforeEach(() => {
        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);
        //consent
        cy.contains("Do you consent to participate in this experiment?");
        cy.contains("This experiment is part of a scientific project. Your decision to participate in this experiment is entirely voluntary. There are no known or anticipated risks to participating in this experiment. There is no way for us to identify you. The only information we will have, in addition to your responses, is the timestamps of your interactions with our site. The results of our research may be presented at scientific meetings or published in scientific journals. Clicking on the \"I AGREE\" button indicates that you are at least 18 years of age, and agree to participate voluntary.");
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.contains("Enter your Player Identifier");
        cy.get('input').click().type(randomPlayerKey2);
        cy.get('button').contains("Enter").click();
        cy.wait(100);

        cy.get('button').contains("Next").click();

        cy.get('input').click().type(randomPlayerKey2);
        cy.get('button').contains("Next").click();
        cy.wait(3000);
        cy.contains(" My camera and microphone are enabled.").click();
        cy.contains(" I can see my full face in the video window."). click();
        cy.contains(" (i.e. a diploma on the wall, the name of an employer).").click();
        cy.contains(" My background doesn't reveal other personal information I am not comfortable sharing.").click();
        cy.contains(" I am in a safe place to engage in a discussion.").click();
        cy.contains(" I am in a space where I can speak freely without bothering other people.").click();
        cy.contains(" I will not be interrupted").click();
        cy.get('button').contains("Next").click(); 
    })

    afterEach(() => {
        cy.contains("Reset Current Session").click({force: true});
    });

    after(() => {
        cy.visit('http://localhost:3000/admin/');
        cy.get('button').contains(" Stop").click();
        cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});
    })

    it("fail understanding check", () => {
        cy.contains("Answer the following questions to confirm your understanding of the instructions.");
        cy.get('label').contains("Partcipate in a discussion with other participants").click();
        cy.get('label').contains("Write about your group's discussion").click();
        cy.get('label').contains("To be anonmously published in academic venues.").click();
        cy.get('label').contains("To disclose to other participants during the session").click();
        cy.get('label').contains("To analyze for behavioral patterns to support our research.").click();
        cy.get('label').contains("To share with select researchers under confidentiality agreements.").click();
        cy.get('label').contains("5-10 minutes").click();
        cy.get('button').contains('Next').click();
        cy.wait(200);
        cy.contains("Answer the following questions to confirm your understanding of the instructions.");
    });

    it("pass understanding check", () => {
        cy.contains("Answer the following questions to confirm your understanding of the instructions.");
        cy.get('label').contains("Partcipate in a discussion with other participants").click();
        cy.get('label').contains("Write about your group's discussion").click();
        cy.get('label').contains("To be anonmously published in academic venues.").click();
        cy.get('label').contains("To disclose to other participants during the session").click();
        cy.get('label').contains("To analyze for behavioral patterns to support our research.").click();
        cy.get('label').contains("To share with select researchers under confidentiality agreements.").click();
        cy.get('label').contains("For quality control").click();
        cy.get('label').contains("15-35 minutes").click();
        cy.get('button').contains('Next').click();
        cy.wait(500);
        cy.get('iframe');
    })
})