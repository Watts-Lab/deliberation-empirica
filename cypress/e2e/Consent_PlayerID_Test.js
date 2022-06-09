describe("consent and playerID entry language", () => {

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
    });
    
    after(() => {
        cy.visit('http://localhost:3000/admin/');
        cy.get('button').contains(" Stop").click();
    })

    it("consent form", () => {
        const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
        const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey1}`);
        cy.visit(`http://localhost:3000/?playerKey=${randomPlayerKey2}`);
        cy.contains("Informed Consent");
        cy.contains("This activity is part of a scientific experiment to understand the process of group deliberation");
        cy.get('button').contains("I AGREE").click();
    })

    it("playerID contains MTurkID", () => {
        cy.contains("Enter your MTurk");
    })
})