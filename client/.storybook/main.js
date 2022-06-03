// .storybook/main.js

module.exports = {
  "stories": [
    "../src/**/*.stories.mdx",
    "../src/**/*.stories.@(js|jsx|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions"
  ],
  "framework": "@storybook/react",
  webpackFinal: async (config) => {
    config.resolve.alias['usePlayer'] = require.resolve('../.storybook/__mocks__/usePlayer.js');
    return config;
  },
}