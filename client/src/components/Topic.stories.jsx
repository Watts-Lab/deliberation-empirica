import React from 'react';
import Topic from './Topic';

export default {
  title: 'Topic',
  component: Topic,
};

const Template = (args) => <Topic {...args} />;

const md = `## Markdown or HTML?
We need to decide whether to use Markdown or HTML for storing 
[deliberation](https://www.annualreviews.org/doi/abs/10.1146/annurev.polisci.11.081306.070308) topics.
<!--- Just kidding, we were always going to use markdown, its so much simpler to implement --->

- **Markdown** files are a convenient way to include basic formatting in a human-readable plain text document that can be easily version controlled. 
- **HTML** documents allow for more customization, but are more difficult to write and to read without a renderer. 

_Which format is better for this task?_"`

export const Loaded = Template.bind({});
Loaded.args = {
  topic:md
};