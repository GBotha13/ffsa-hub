"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Edit2,
  CornerDownRight,
  GripVertical,
  Lock,
} from "lucide-react";

export type TreeQuestion = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  sort_order: number;
  is_required: boolean;
  options: string[] | null;
  parent_question_id: string | null;
  show_when_answer: string | null;
  is_system?: boolean;
  system_key?: string | null;
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_answer: "Short",
  long_answer: "Essay",
  multiple_choice: "Multiple Choice",
  yes_no: "Yes/No",
  checkbox_group: "Checkboxes",
  country: "Country",
  phone: "Phone",
  date: "Date",
  email: "Email",
  file: "Photo",
  consent: "Consent",
  section_header: "Header",
};

export function QuestionTree({
  questions,
  onEdit,
  onDelete,
  onReorder,
  onAddFollowUp,
}: {
  questions: TreeQuestion[];
  onEdit: (q: TreeQuestion) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onAddFollowUp: (parent: TreeQuestion) => void;
}) {
  const childrenByParent = new Map<string, TreeQuestion[]>();
  for (const q of questions) {
    if (!q.parent_question_id) continue;
    const list = childrenByParent.get(q.parent_question_id) ?? [];
    list.push(q);
    childrenByParent.set(q.parent_question_id, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }

  const topLevel = questions
    .filter((q) => !q.parent_question_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const questionById = new Map(questions.map((q) => [q.id, q]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeQ = questionById.get(String(active.id));
    const overQ = questionById.get(String(over.id));
    if (!activeQ || !overQ) return;

    const activeParent = activeQ.parent_question_id ?? null;
    const overParent = overQ.parent_question_id ?? null;
    if (activeParent !== overParent) return;

    const siblings = activeParent
      ? (childrenByParent.get(activeParent) ?? [])
      : topLevel;
    const oldIdx = siblings.findIndex((q) => q.id === active.id);
    const newIdx = siblings.findIndex((q) => q.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const newOrder = arrayMove(siblings, oldIdx, newIdx);
    onReorder(newOrder.map((q) => q.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={topLevel.map((q) => q.id)}
        strategy={verticalListSortingStrategy}
      >
        {topLevel.map((q) => (
          <QuestionTreeNode
            key={q.id}
            question={q}
            depth={0}
            childrenByParent={childrenByParent}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddFollowUp={onAddFollowUp}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function QuestionTreeNode({
  question,
  depth,
  childrenByParent,
  onEdit,
  onDelete,
  onAddFollowUp,
}: {
  question: TreeQuestion;
  depth: number;
  childrenByParent: Map<string, TreeQuestion[]>;
  onEdit: (q: TreeQuestion) => void;
  onDelete: (id: string) => void;
  onAddFollowUp: (parent: TreeQuestion) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: depth > 0 ? 24 : 0,
  };

  const children = childrenByParent.get(question.id) ?? [];
  const canHaveFollowUps =
    question.type === "yes_no" || question.type === "multiple_choice";
  const showWhen = question.show_when_answer;
  const showWhenLabel =
    showWhen === "yes" ? "Yes" : showWhen === "no" ? "No" : showWhen;

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-6 w-6 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {depth > 0 && (
          <CornerDownRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{question.label}</span>
            <Badge variant="secondary" className="text-xs">
              {QUESTION_TYPE_LABELS[question.type] ?? question.type}
            </Badge>
            {question.is_required && (
              <Badge variant="secondary" className="text-xs">Required</Badge>
            )}
            {question.is_system && (
              <Badge variant="outline" className="text-xs" title="Built-in question — reorder freely, but can't be deleted or made optional">
                <Lock className="h-2.5 w-2.5 mr-1" /> Locked
              </Badge>
            )}
            {depth > 0 && showWhenLabel && (
              <Badge variant="outline" className="text-xs">
                Shown when answer is &ldquo;{showWhenLabel}&rdquo;
              </Badge>
            )}
          </div>
          {question.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {question.description}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {canHaveFollowUps && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => onAddFollowUp(question)}
              title="Add a follow-up question that appears based on this answer"
            >
              <Plus className="h-3 w-3 mr-1" /> Follow-up
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => onEdit(question)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          {!question.is_system && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(question.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {children.length > 0 && (
        <SortableContext
          items={children.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {children.map((child) => (
            <QuestionTreeNode
              key={child.id}
              question={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddFollowUp={onAddFollowUp}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}
