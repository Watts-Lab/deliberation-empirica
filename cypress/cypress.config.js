module.exports = {
  projectId: "htzagd",
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // eslint-disable-next-line global-require
      return require("./plugins/index")(on, config);
    },
    baseUrl: "http://localhost:3000",
    specPattern: "../cypress/e2e/**/*.{js,jsx,ts,tsx}",
    supportFile: "../cypress/support/e2e.{js,jsx,ts,tsx}",
  },
};
