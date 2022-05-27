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

  const topicText = `## Markdown or HTML?
  We need to decide whether to use Markdown or HTML for storing 
  [deliberation](https://www.annualreviews.org/doi/abs/10.1146/annurev.polisci.11.081306.070308) topics.
  <!-- Just kidding, we were always going to use markdown, its so much simpler to implement -->
  
  - **Markdown** files are a convenient way to include basic formatting in a human-readable plain text document that can be easily version controlled. 
  - **HTML** documents allow for more customization, but are more difficult to write and to read without a renderer. 
  
  _Which format is better for this task?_"`

  const round = {
    id: 5,
    data: {"topic": topicText},
    get (key) {
      return this.data[key]
    }
  }

//👇 Each story then reuses that template
export const Primary = Template.bind({});
Primary.args = {
   player: player,
   round: round
}; 
