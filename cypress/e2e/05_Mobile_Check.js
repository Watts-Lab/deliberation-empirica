// Mobile_Check.js
// This test aims to test what a user will encounter if they
// attempt to complete the experiment on a mobile device

describe('Disallow mobile connections', () => {
  before(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch('cypress1_control');

    // Start batch
    cy.get('tr', { log: false })
      .last({ log: false })
      .contains('Start', { log: false })
      .click({ log: 'Start Button' });
    // Check started
    cy.waitUntil(() => cy
      .get('tr')
      .last()
      .then($tr => $tr.find('button:contains("Stop")').length === 1));
  });

  it('redirects to mobile error screen', () => {
    const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
    const playerKeys = [playerKey]
    cy.empiricaLoginPlayers({ playerKeys });
    cy.viewport('iphone-x');

    cy.visit(`http://localhost:3000/?playerKey=${playerKey}`, {
      onBeforeLoad: win => {
        Object.defineProperty(win.navigator, 'userAgent', {
          value:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
        });
      },
    });

    cy.contains('ERROR: Mobile Device Detected');
  });
});
