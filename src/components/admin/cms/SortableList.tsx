/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic sortable list: drag-and-drop via @dnd-kit plus keyboard-accessible
// Move up/Move down buttons.

import * as React from "react";
import { DndContext, PointerSensor, useSensor, useSensors, KeyboardSensor } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

function SortableItem<T>({
  item,
  index,
  getId,
  moveUp,
  moveDown,
  children,
}: {
  item: T;
  index: number;
  getId: (item: any, index: number) => string;
  moveUp: () => void;
  moveDown: () => void;
  children: React.ReactNode;
}) {
  const id = getId(item, index);
  const { attributes, listeners, setNodeRef } = useSortable({
    id,
    strategy: verticalListSortingStrategy,
  });
  return (
    <div key={id} ref={setNodeRef} {...attributes} {...listeners} data-testid="sortable-item">
      {children}
    </div>
  );
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
}: {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (next: T[]) => void;
  renderItem: (
    item: T,
    {
      index,
      isDragging,
      moveUp,
      moveDown,
    }: {
      index: number;
      isDragging: boolean;
      moveUp: () => void;
      moveDown: () => void;
    },
  ) => React.ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = items.findIndex((i) => getId(i, items.indexOf(i)) === activeId);
    const newIndex = items.findIndex((i) => getId(i, items.indexOf(i)) === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  const moveItem = (id: string, delta: number) => {
    const index = items.findIndex((i) => getId(i, items.indexOf(i)) === id);
    if (index < 0) return;
    const next = arrayMove(items, index, index + delta);
    onReorder(next);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((i, ix) => String(getId(i, ix)))}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item, index) => {
          const id = getId(item, index);
          return (
            <SortableItem
              key={id}
              item={item}
              index={index}
              getId={getId}
              moveUp={() => moveItem(id, -1)}
              moveDown={() => moveItem(id, 1)}
            >
              {renderItem(item, {
                index,
                isDragging: false,
                moveUp: () => moveItem(id, -1),
                moveDown: () => moveItem(id, 1),
              })}
            </SortableItem>
          );
        })}
      </SortableContext>
    </DndContext>
  );
}
