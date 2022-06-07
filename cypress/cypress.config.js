module.exports = {
  projectId: 'htzagd',
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('plugins/index.js')(on, config)
    },
    specPattern: 'e2e/**/*.{js,jsx,ts,tsx}',
  },
}
