// No_Experiments_Available.js
// This tests that the user is not presented with a game option 
// if there are no games available.

describe("No experiments available", () => {

    before(() => {
        cy.empiricaCreateBatch("cypress1_control");
        cy.empiricaClearBatches();
        
    });

    it("has no games available", () => {
        const playerKey = 'test_'+Math.floor(Math.random() * 1e13)
        
        cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);
           
        cy.contains("No experiments available")
        cy.wait(10000)
        cy.contains("consent").should("not.exist");
        cy.contains("I AGREE").should("not.exist");
    })

});