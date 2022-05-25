import React from 'react';

import Discussion from './Discussion';

export default {
  /* 👇 The title prop is optional.
  * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
  * to learn how to generate automatic titles
  */
  title: 'Discussion',
  component: Discussion,
};

//👇 We create a “template” of how args map to rendering
const Template = (args) => <Discussion {...args} />;

const player = {
    data: {"name": "Ponder Stibbons"},
    get (key) {
      return this.data[key];
    }
  }

  const round = {
    id: 5,
    topic: "gun control"
  }

//👇 Each story then reuses that template
export const Primary = Template.bind({});
Primary.args = {
   player: player,
   round: round
};