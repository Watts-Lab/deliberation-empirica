// No_Experiments_Available.js
// This tests that the user is not presented with a game option 
// if there are no games available.

describe("normal_paths", () => {
    const condition = "cypress1";
    const playerKey = 'test_'+Math.floor(Math.random() * 1e13)

    before(() => {
        cy.viewport(2000, 1000)
        cy.visit('/admin/');

        // wait for page load
        cy.contains('Batches are groups of Games', { timeout: 5000 } ).should('be.visible');
        

        //enter new batch drawer
        cy.get('button').contains('New Batch').click()
        cy.contains('Create a new Batch with Simple', { timeout: 500 } ).should('be.visible');
        cy.get('select').select(condition);
        cy.contains('game', { timeout: 500 }).should('be.visible'); // wait for the condition to be loaded
        cy.get('button[type="submit"]').click()

        //return from new batch drawer
        cy.waitUntil(() => cy.get('form').should('not.be.visible'));
        //check that game is ready to start
        cy.get('tr').last().contains("Created")
        cy.get('tr').last().contains(condition)
        cy.get('tr').last().contains("Start")


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
        cy.wait(10000)
        cy.contains("consent").should("not.exist");
        cy.contains("I AGREE").should("not.exist");
    })

});