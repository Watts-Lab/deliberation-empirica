/* eslint-disable react/jsx-props-no-spreading */
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import React from "react";
import { P } from "./TextStyles";

// a little function to help us with reordering the result
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

function ListItem({ id, index, text }) {
  return (
    <Draggable key={id} draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`px-3 py-2 border bg-gray-100 rounded-md shadow-sm ${
            snapshot.isDragging ? "border-gray-600" : "border-gray-300"
          }`}
          data-test={`draggable-${index}`}
        >
          ⇅ {text}
        </div>
      )}
    </Draggable>
  );
}

function List({ list }) {
  const displayIndex = [...Array(list.length + 1).keys()].slice(1);
  return (
    <div className="flex border border-gray-300 rounded-md shadow-sm">
      <div className="grid p-2">
        {displayIndex.map((i) => (
          <P>{i}. </P>
        ))}
      </div>
      <Droppable droppableId="droppable">
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`grid gap-2  p-2
          ${snapshot.isDraggingOver ? "" : ""} 
          `}
          >
            {list.map((item, index) => (
              <ListItem key={item} id={item} index={index} text={item} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export function ListSorter({ list, onChange, testId }) {
  const onDragEnd = (result) => {
    if (!result.destination) return; // dropped outside the list
    const items = reorder(list, result.source.index, result.destination.index);
    onChange(items);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd} data-test={testId}>
      <List list={list} />
    </DragDropContext>
  );
}
