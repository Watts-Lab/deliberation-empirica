// import React from 'react';
// import { EnterNickname } from './EnterNickname';

// export default {
//   title: 'Enter Nickname',
//   component: EnterNickname,
// };

// const Template = (args) => <EnterNickname {...args} />;

// function usePlayer(){
//   const player = {
//     data: {"name": "Ponder Stibbons"},
//     get (key) {
//       return this.data[key];
//     }
//   }

//   return player
// }


// function next(){
//   console.log("Advancing to next page.")
// }

// //👇 Each story then reuses that template
// export const Primary = Template.bind({});
// Primary.args = {
//   next, usePlayer
// };