"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addChecklistItemAction,
  deleteChecklistItemAction,
  updateChecklistItemAction,
} from "@/server/actions/board";
import type { ActionResult } from "@/server/errors";
import type { Board } from "@/server/services/board";
import type { ChecklistItem } from "@/server/services/checklists";

import { boardKey, patchTask, taskKey, useBoardContext, type TaskDetailJson } from "./board-data";
import { CAPTURES_ESCAPE } from "./task-comments";

/** The task's checklist: tick items off, add, rename and remove them. */
export function TaskChecklist({
  taskId,
  items,
  editable,
}: {
  taskId: string;
  items: ChecklistItem[];
  editable: boolean;
}) {
  const { orgId, projectId } = useBoardContext();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const done = items.filter((item) => item.done).length;

  /** Shows `next` right away (in the panel and on the card), then saves and refetches. */
  async function change<T>(next: ChecklistItem[], save: () => Promise<ActionResult<T>>) {
    const previous = queryClient.getQueryData<TaskDetailJson>(taskKey(taskId));
    const previousBoard = queryClient.getQueryData<Board>(boardKey(projectId));
    queryClient.setQueryData<TaskDetailJson>(taskKey(taskId), (current) =>
      current ? { ...current, checklist: next } : current,
    );
    queryClient.setQueryData<Board>(boardKey(projectId), (current) =>
      current
        ? patchTask(current, taskId, {
            checklist:
              next.length === 0
                ? null
                : { done: next.filter((i) => i.done).length, total: next.length },
          })
        : current,
    );
    const result = await save();
    if (!result.ok) {
      queryClient.setQueryData(taskKey(taskId), previous);
      queryClient.setQueryData(boardKey(projectId), previousBoard);
      toast.error(result.error.message);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKey(taskId) }),
      queryClient.invalidateQueries({ queryKey: boardKey(projectId) }),
    ]);
  }

  function add() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    const placeholder = { id: `new-${Date.now()}`, title, done: false };
    void change([...items, placeholder], () => addChecklistItemAction({ orgId, taskId, title }));
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Checklist</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {done} of {items.length} done
          </span>
        )}
      </div>
      {items.length > 0 && (
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-smooth"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      )}
      <ul className="grid gap-0.5" aria-label="Checklist items">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            editable={editable && !item.id.startsWith("new-")}
            onToggle={(checked) => {
              void change(
                items.map((i) => (i.id === item.id ? { ...i, done: checked } : i)),
                () =>
                  updateChecklistItemAction({ orgId, itemId: item.id, changes: { done: checked } }),
              );
            }}
            onRename={(title) => {
              void change(
                items.map((i) => (i.id === item.id ? { ...i, title } : i)),
                () => updateChecklistItemAction({ orgId, itemId: item.id, changes: { title } }),
              );
            }}
            onDelete={() => {
              void change(
                items.filter((i) => i.id !== item.id),
                () => deleteChecklistItemAction({ orgId, itemId: item.id }),
              );
            }}
          />
        ))}
      </ul>
      {editable && (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            placeholder="Add an item…"
            aria-label="New checklist item"
            maxLength={200}
            className="h-8"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!draft.trim()}>
            <Plus aria-hidden /> Add
          </Button>
        </form>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  editable,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ChecklistItem;
  editable: boolean;
  onToggle: (done: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  function save() {
    setEditing(false);
    const next = title.trim();
    if (next && next !== item.title) onRename(next);
    else setTitle(item.title);
  }

  return (
    <li className="group/item flex min-h-8 items-center gap-2.5 rounded-md px-1 hover:bg-muted/50">
      <Checkbox
        checked={item.done}
        disabled={!editable}
        aria-label={item.title}
        onCheckedChange={(checked) => {
          onToggle(checked === true);
        }}
      />
      {editing ? (
        <Input
          autoFocus
          value={title}
          maxLength={200}
          aria-label="Item"
          className="h-7"
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          // Escape cancels the edit without closing the task panel.
          {...{ [CAPTURES_ESCAPE]: "" }}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") {
              setTitle(item.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            setTitle(item.title);
            setEditing(true);
          }}
          className={cn(
            "min-w-0 flex-1 truncate py-1 text-left text-sm outline-none focus-visible:underline disabled:cursor-default",
            item.done && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </button>
      )}
      {editable && !editing && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${item.title}`}
          className="opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"
          onClick={onDelete}
        >
          <X aria-hidden />
        </Button>
      )}
    </li>
  );
}
