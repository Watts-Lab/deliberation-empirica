import React from "React";
import CheckUnderstanding from "src/intro-exit/CheckUnderstanding";


describe("intro screen tests", () => {
    before(() => {
        cy.visit('http://localhost:3000/admin/');
        cy.get("button").contains('New Batch').click();
        cy.get('select').select("2 players 2 seconds");
        cy.get('form').submit();
        cy.get('button').contains(" Start").click();
    })

    after(() => {
        cy.exec("cd .. && cd .empirica/local && rm tajriba.json", {failOnNonZeroExit: false});
    })

    it("fail understanding check", () => {
        cy.contains("Answer the following questions to confirm your understanding of the instructions.");
    })
})