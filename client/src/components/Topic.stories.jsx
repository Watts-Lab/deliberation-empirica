import React from 'react';

import { Topic } from './Topic';

export default {
  title: 'Topic',
  component: Topic,
};

const Template = (args) => <Topic {...args} />;

const md = "example here"

export const Loaded = Template.bind({});
Loaded.args = {
  md:md
};