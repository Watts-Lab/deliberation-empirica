/* eslint-disable react/jsx-props-no-spreading */
import { DragDropContext, Droppable, Draggable } from "dnd";
import React from "react";
import { P } from "../components/TextStyles";

// a little function to help us with reordering the result
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
  // some basic styles to make the items look a bit nicer
  userSelect: "none",
  padding: grid * 2,
  margin: `0 0 ${grid}px 0`,

  // change background colour if dragging
  background: isDragging ? "lightgreen" : "grey",

  // styles we need to apply on draggables
  ...draggableStyle,
});

const grid = 8;
const getListStyle = (isDraggingOver) => ({
  background: isDraggingOver ? "lightblue" : "lightgrey",
  padding: grid,
  width: 250,
});

function ListItem({ id, index, text }) {
  return (
    <Draggable key={id} draggableId={id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={getItemStyle(
            snapshot.isDragging,
            provided.draggableProps.style
          )}
        >
          ⇅ {text}
        </div>
      )}
    </Draggable>
  );
}

function List({ list }) {
  return (
    <Droppable droppableId="droppable">
      {(provided, snapshot) => (
        <div
          {...provided.droppableProps}
          ref={provided.innerRef}
          style={getListStyle(snapshot.isDraggingOver)}
        >
          {list.map((item, index) => (
            <ListItem
              key={item.id}
              id={item.id}
              index={index}
              text={item.text}
            />
          ))}
        </div>
      )}
    </Droppable>
  );
}

export function ListSorter({ list }) {
  function onDragEnd(result) {
    // dropped outside the list
    if (!result.destination) {
      return;
    }

    // const items = reorder(
    //   this.state.items,
    //   result.source.index,
    //   result.destination.index
    // );

    // this.setState({
    //   items
    // });
  }

  return (
    
  );
}
