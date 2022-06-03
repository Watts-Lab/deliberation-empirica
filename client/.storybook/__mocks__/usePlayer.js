// Mocks the usePlayer hook
// https://storybook.js.org/docs/react/writing-stories/build-pages-with-storybook#mocking-imports

export function usePlayer(){
    const player = {
      data: {"name": "Ponder Stibbons"},
      get (key) {
        return this.data[key];
      }
    }
  
    return player
  }