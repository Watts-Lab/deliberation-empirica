module.exports = {
  projectId: 'htzagd',
  e2e: {
    setupNodeEvents(on, config) {
      return require('../cypress/plugins/index.js')(on, config)
    },
    baseUrl: 'https://deliberation-9fltg.ondigitalocean.app/',
    specPattern: '../cypress/e2e/**/*.{js,jsx,ts,tsx}',
    supportFile: '../cypress/support/e2e.{js,jsx,ts,tsx}'
  },
}
