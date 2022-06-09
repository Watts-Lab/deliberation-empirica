// Normal_Paths.js
// This test aims to test all the functionality that a user
// will encounter if they proceed through the experiement as expected


describe("normal_paths", () => {
  const soloCondition = "cypress1";

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

    //enter new batch drawer
    cy.get('button').contains('New Batch').click()
    cy.contains('Create a new Batch with Simple', { timeout: 500 } ).should('be.visible');
    cy.get('select').select(soloCondition);
    cy.contains('game', { timeout: 500 }).should('be.visible'); // wait for the condition to be loaded
    cy.get('form').submit();

    //return from new batch drawer
    cy.contains('Create a new Batch with Simple', { timeout: 500 } ).should('not.exist');
    cy.get('tr').last().should(($tr) => {
        expect($tr).to.contain("Created")
        expect($tr).to.contain(soloCondition)
    });
    cy.contains("Created", { timeout: 500 } );
    
  });

  it("passes", () => {
    const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
    const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
    
    cy.visit(`?playerKey=${randomPlayerKey1}`)

  })


})