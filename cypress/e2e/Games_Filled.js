// Game_Filled.js

describe("All games fill up with extra player in intro steps", () => {
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

    it("redirects to sorry on game full", () => {

        //Non-completing player
        cy.visit(`http://localhost:3000/?playerKey=${playerKey+"no_complete"}`);

        cy.log("Consent")
        cy.contains("consent", { timeout: 5000 });       
        cy.get('button').contains('I AGREE').click();

        // Login
        cy.log("Enter Username")
        cy.contains("Enter your", { timeout: 5000 });
        cy.get('input').click().type(playerKey);
        cy.get('button').contains("Enter").click();
        

        //TODO: Completing player


    })

});