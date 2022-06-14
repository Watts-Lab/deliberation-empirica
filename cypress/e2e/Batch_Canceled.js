// Batch_Canceled.js

describe("Batch is canceled with player in intro steps", () => {
    const condition = "cypress1";
    const playerKey = 'test_'+Math.floor(Math.random() * 1e13)

    before(() => {

        cy.empiricaClearBatches()
        cy.empiricaCreateBatch("cypress1")
        
        //Start batch
        cy.get('tr', { log: false })
          .last({ log: false })
          .contains("Start", { log: false })
          .click( {log: "Start Button"})

        //Check started
        cy.waitUntil(() => 
            cy.get('tr').last().then( $tr => $tr.find('button:contains("Stop")').length == 1)
        )
        
    });

    it("redirects to sorry on batch cancel", () => {

        cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);

        cy.log("Consent")
        cy.contains("consent", { timeout: 5000 });       
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.log("Enter Username")
        cy.contains("Enter your", { timeout: 5000 });
        cy.get('input').click().type(playerKey);
        cy.get('button').contains("Enter").click();
        

        // Cancel Batch
        cy.empiricaClearBatches()

        // Check redirect to correct screen
        cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);
        cy.wait(3000)
        cy.contains("About").should("not.exist");
        // TODO @kailyl: Check that sorry page displays here

        // cy.get('button').contains("Next").click({force: true})
    })

});