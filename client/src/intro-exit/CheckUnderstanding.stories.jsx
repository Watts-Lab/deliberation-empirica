import React from 'react';
import { CheckUnderstanding } from './CheckUnderstanding';

export default {
  title: 'Check Understanding',
  component: CheckUnderstanding,
};

const Template = (args) => <CheckUnderstanding {...args} />;


function next(){
  console.log("Advancing to next page.")
}

//👇 Each story then reuses that template
export const Primary = Template.bind({});
Primary.args = {
  next
};