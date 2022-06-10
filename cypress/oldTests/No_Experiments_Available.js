describe("normal_paths", () => {
    const condition = "cypress1";
    const playerKey = 'test_'+Math.floor(Math.random() * 1e13)

    before(() => {
        cy.viewport(2000, 1000)
        cy.visit('/admin/');

        // wait for page load
        cy.contains('Batches are groups of Games', { timeout: 5000 } ).should('be.visible');
        
        //start all existing unstarted batches
        cy.get('body')
        .then( ($body) => {
            const startButtons = $body.find('button:contains("Start")')
            cy.log(startButtons.length + " unlaunched batches will be started")
            if ( startButtons.length ) {
                cy.wrap(startButtons, {log: false}).each(
                    ($button, index, $list) => {
                    cy.wrap($button, {log: false}).click()
                    } 
                )
            } 
        })
        cy.waitUntil(() => cy.get('body').then( $body => $body.find('button:contains("Start")').length < 1),
                    {customMessage:"all unlaunched games are started"})
        
        //stop all existing unstarted batches
        cy.get('body')
        .then( ($body) => {
            const stopButtons = $body.find('button:contains("Stop")')
            cy.log(stopButtons.length + " running games will be stopped")
            if ( stopButtons.length ) {
                cy.wrap(stopButtons, {log: false}).each(
                ($button, index, $list) => {
                    cy.wrap($button, {log: false}).click()
                } 
                )
            } 
        })
        cy.waitUntil(() => cy.get('body').then( $body => $body.find('button:contains("Stop")').length < 1),
                    {customMessage:"all games are stopped"}
        )
        
    });

    it("has no games available", () => {
        
        cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);
           
        cy.contains("No experiments available")
        cy.wait(30000)
        cy.contains("Informed Consent").should("not.exist");
    })

});

