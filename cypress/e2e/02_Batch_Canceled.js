// Batch_Canceled.js

describe("Batch canceled", () => {
    const condition = "cypress1";

    beforeEach(() => {

        cy.empiricaClearBatches()
        cy.empiricaCreateBatch("cypress1long")
        
        //Start batch
        cy.get('tr', { log: false })
          .last({ log: false })
          .contains("Start", { log: false })
          .click( {log: "Start Button"})

        //Check started
        cy.waitUntil(() => 
            cy.get('tr', { log: false })
              .last({ log: false })
              .then( $tr => $tr.find('button:contains("Stop")').length == 1), 
            { log: false }
        )
        
    });

    it("from intro steps", () =>{
        const playerKey = 'test_'+Math.floor(Math.random() * 1e13)

        cy.empiricaLoginPlayer(playerKey)
        cy.wait(1000)
        // Cancel Batch
        cy.empiricaClearBatches()
        cy.wait(1000)

        // Check that player canceled
        cy.visit(`/?playerKey=${playerKey}`);
        cy.contains("About this study").should("not.exist");
        cy.contains("No experiments available")

    });

    it("from game", () => {
        const playerKey = 'test_'+Math.floor(Math.random() * 1e13)
        cy.empiricaLoginPlayer(playerKey)

        //Instructions
        cy.contains("About this study:", { timeout: 5000 });
        // Understanding check
        cy.contains("Answer the following questions", { timeout: 5000 });
        cy.get("label").contains("Partcipate in and answer questions").click();
        cy.get("label").contains("True").click();
        cy.get("label").contains("anonmously published").click();
        cy.get("label").contains("Our research team").click();
        cy.get("label").contains("15-35 minutes").click();
        cy.get("button").contains("Next").click();

        // Name Input
        cy.contains("please enter your first name", { timeout: 5000 });
        cy.get("input")
        .click()
        .type(playerKey + "_name");
        cy.get("button").contains("Next").click();

        // Video check
        cy.contains("Check your webcam", { timeout: 5000 });
        cy.get('input[id="enabled"]').click();
        cy.get('input[id="see"]').click();
        cy.get('input[id="noName"]').click();
        cy.get('input[id="background"]').click();
        cy.get('input[id="safeplace"]').click();
        cy.get('input[id="speakFree"]').click();
        cy.get('input[id="noInterrupt"]').click();
        cy.get("button").contains("Next").click();

        // Preread of topic
        cy.log("Initial Question");
        cy.contains("This is the topic", { timeout: 5000 });
        // This is flaky!  https://www.cypress.io/blog/2020/07/22/do-not-get-too-detached/
        cy.contains("Neither favor nor oppose").click({ force: true });
        cy.contains("Unsure").click({ force: true }); // flake backup

        cy.get("form") // submit surveyJS form
        .then(($form) => {
            cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
        });

        // in game body
        cy.get('[data-test="profile"]', { timeout: 20000 });

        // Cancel Batch
        cy.empiricaClearBatches()
        cy.visit(`/?playerKey=${playerKey}`);
        cy.get('[data-test="profile"]', { timeout: 20000 }).should("not.exist");
        
        // Todo: check in post-survey


    });

});