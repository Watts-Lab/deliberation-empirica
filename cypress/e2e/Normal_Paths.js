// Normal_Paths.js
// This test aims to test all the functionality that a user
// will encounter if they proceed through the experiement as expected

//import { get } from "cypress/types/lodash";

describe("normal_paths", () => {
  const soloCondition = "cypress1";

  before(() => {
    cy.viewport(1500, 1000)
    cy.visit('/admin/');

    // wait for page load
    cy.contains('Batches are groups of Games', { timeout: 5000 } ).should('be.visible');
    
    //start and close all existing batches
    cy.intercept('GET', '**/treatments').as('getTreatments')

    cy.get('button')
      .then(($btnList) => { if (Cypress.$('button:contains("Start")')) {
         $btnList.filter(':contains("Start")') // https://docs.cypress.io/api/commands/filter#Contains
                 .each( ($button) => {cy.wrap($button).click().wait('@getTreatments')} )
      }})
      .then( cy.contains('button', "Start").should('not.exist'))
      .get('button')
      .filter(':contains("Stop")')
      .each( ($button) => {cy.wrap($button).click()})
      .waitUntil( 
        () => {cy.contains('button', "Stop").should('not.exist')},
        {timeout: 3000} 
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
    }
    
    
    )
    cy.contains("Created", { timeout: 500 } ).should('be.visible');
    
    

  });

  it("passes", () => {
    const randomPlayerKey1 = Math.floor(Math.random() * 1e13);
    const randomPlayerKey2 = Math.floor(Math.random() * 1e13);
    
    cy.visit(`?playerKey=${randomPlayerKey1}`)

  })


})