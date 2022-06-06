import React from 'react';
import { Introduction } from './Introduction';

export default {
  title: 'Introduction',
  component: Introduction,
};

const Template = (args) => <Introduction {...args} />;

function next(){
    console.log("Advancing to next page.")
  }
  
  //👇 Each story then reuses that template
  export const Primary = Template.bind({});
  Primary.args = {
    next
  };