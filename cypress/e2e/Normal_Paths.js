// Normal_Paths.js
// This test aims to test all the functionality that a user
// will encounter if they proceed through the experiement as expected


describe("normal_paths", () => {
    const condition = "cypress1";
    // if we launch more players than we have slots in the game
    // we should be able to check that the gameFull page displays
    const playerKeys = [
        //'test_'+Math.floor(Math.random() * 1e13),
        'test_'+Math.floor(Math.random() * 1e13)
    ]

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
        cy.waitUntil(
            () => cy.get('body').then( $body => $body.find('button:contains("Start")').length < 1),
            {customMessage:"all unlaunched games are started"}
        )
        
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
        cy.waitUntil(
            () => cy.get('body').then( $body => $body.find('button:contains("Stop")').length < 1),
            {customMessage:"all games are stopped"}
        )

        //enter new batch drawer
        cy.get('button').contains('New Batch').click()
        cy.contains('Create a new Batch with Simple', { timeout: 500 } ).should('be.visible');
        cy.get('select').select(condition);
        cy.contains('game', { timeout: 500 }).should('be.visible'); // wait for the condition to be loaded
        cy.get('button[type="submit"]').click()

        //return from new batch drawer
        cy.waitUntil(() => cy.get('form').should('not.be.visible'));
        cy.get('tr').last().contains("Created")
        cy.get('tr').last().contains(condition)
        cy.get('tr').last().contains("Start").click()
        cy.waitUntil(() => 
            cy.get('tr').last().then( $tr => $tr.find('button:contains("Stop")').length == 1)
        )
        
    });

    it("walks properly", () => {
        cy.log("Log in all players")
        cy.wrap(playerKeys, {log: false}).each( (playerKey) => {
            cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);

            cy.log("Consent")
            //cy.contains("Informed Consent", { timeout: 5000 });       
            cy.contains("consent", { timeout: 5000 });       
            cy.get('button').contains('I AGREE').click();

            // Login
            cy.log("Consent")
            cy.contains("Enter your", { timeout: 5000 });
            cy.get('input').click().type(playerKey);
            cy.get('button').contains("Enter").click();
        })
    
        cy.log("Advance all players to lobby")
        cy.wrap(playerKeys, {log: false}).each( (playerKey) => {
            cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);

            //Instructions 
            cy.contains("About this study:", { timeout: 5000 }); 
            cy.get('button').contains("Next").click({force: true});
            
            // Name Input
            cy.contains("please enter your first name", { timeout: 5000 })
            cy.get('input').click().type(playerKey+'_name');
            cy.get('button').contains("Next").click();  

            // Video check
            cy.contains("Check your webcam", { timeout: 5000 })
            //cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

            cy.contains(" My camera and microphone are enabled.").click();
            cy.contains(" I can see my full face in the video window."). click();
            cy.contains(" (i.e. a diploma on the wall, the name of an employer).").click();
            
            cy.get('button').contains("Next").click(); // not everything is checked!
            cy.on('window:alert',(txt)=>{
                expect(txt).to.contains('Please confirm that you are read');
             })

            cy.contains(" My background doesn't reveal other personal information I am not comfortable sharing.").click();
            cy.contains(" I am in a safe place to engage in a discussion.").click();
            cy.contains(" I am in a space where I can speak freely without bothering other people.").click();
            cy.contains(" I will not be interrupted").click();

            cy.get('button').contains("Next").click();  

            // Understanding check
            cy.contains("Answer the following questions to confirm your understanding of the instructions.", { timeout: 5000 });
            cy.get('label').contains("Partcipate in a discussion with other participants").click();
            cy.get('label').contains("Write about your group's discussion").click();
            cy.get('label').contains("To be anonmously published in academic venues.").click();
            cy.get('label').contains("To disclose to other participants during the session").click();
            cy.get('label').contains("For quality control").click();
            cy.get('label').contains("To analyze for behavioral patterns to support our research.").click();
            cy.get('label').contains("To share with select researchers under confidentiality agreements.").click();
            cy.get('label').contains("15-35 minutes").click();
            cy.get('button').contains("Next").click();

            // Preread of topic
            cy.log("Initial Question")
            cy.contains("This is the topic", { timeout: 5000 })
            cy.contains("Neither favor nor oppose").should("be.visible")
            cy.contains("Neither favor nor oppose").click()  // flakiness in the DOM reload: https://www.cypress.io/blog/2020/07/22/do-not-get-too-detached/
            
            cy.get('form') // submit surveyJS form
              .then( ($form) => {
                  cy.wrap($form.find('input[type="button"][value="Complete"]')).click()
              })
            

        })

        cy.log("Advance first player into game")
        const playerKey = playerKeys[0]
        cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);
        
        // in game body
        cy.get('[data-test="profile"]', {timeout: 20000})  // check that profile loaded
         // .then(cy.get('[data-test="skip"]', {timeout: 200}).click({force: true}));

        //team viability survey
        cy.log("Team Viability survey")
        cy.contains("Please select the option", { timeout: 10000 })
        cy.get('tr').first().then( ($row) =>
            cy.wrap($row.find('input[type="radio"][value="2"]')).check()
        )
        
        cy.get('form') // submit surveyJS form
          .then( ($form) => {
              cy.wrap($form.find('input[type="button"][value="Complete"]')).click()
          })
        

    })

})