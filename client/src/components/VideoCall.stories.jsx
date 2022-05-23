import React from 'react';

import { VideoCall } from './VideoCall';

export default {
  /* 👇 The title prop is optional.
  * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
  * to learn how to generate automatic titles
  */
  title: 'VideoCall',
  component: VideoCall,
};

//👇 We create a “template” of how args map to rendering
const Template = (args) => <VideoCall {...args} />;


//👇 Each story then reuses that template
export const Primary = Template.bind({});
Primary.args = {
   playerName: "Ponder Stibbons",
   roomName: "my_test_room_1"
};