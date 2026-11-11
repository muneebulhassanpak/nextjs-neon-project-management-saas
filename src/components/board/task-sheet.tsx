"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, Plus, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";

import { ActivityFeed } from "@/components/activity/activity-feed";
import { PersonAvatar } from "@/components/projects/people";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/projects";
import { canDeleteTask } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  createLabelAction,
  deleteTaskAction,
  moveTaskAction,
  setTaskLabelsAction,
  updateTaskAction,
} from "@/server/actions/board";
import type { Board, BoardTask } from "@/server/services/board";
import type { TaskChanges } from "@/server/services/tasks";

import {
  applyMove,
  boardKey,
  patchTask,
  taskKey,
  tasksByColumn,
  useBoardContext,
  useBoardMutation,
  useTaskDetail,
} from "./board-data";
import { DescriptionEditor } from "./description-editor";
import { LabelChip, labelDot } from "./label-chip";
import { CAPTURES_ESCAPE, TaskComments, useComments } from "./task-comments";
import { formatDueDate, PriorityIcon } from "./task-meta";

export function TaskSheet({
  taskId,
  board,
  onClose,
}: {
  taskId: string | null;
  board: Board;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl"
        onEscapeKeyDown={(event) => {
          // Escape first closes the mention list or cancels a comment edit.
          if (event.target instanceof Element && event.target.closest(`[${CAPTURES_ESCAPE}]`)) {
            event.preventDefault();
          }
        }}
      >
        {taskId && <TaskPanel key={taskId} taskId={taskId} board={board} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskPanel({
  taskId,
  board,
  onClose,
}: {
  taskId: string;
  board: Board;
  onClose: () => void;
}) {
  const { orgId, userId, role, assigned, canEdit } = useBoardContext();
  const queryClient = useQueryClient();
  const task = board.tasks.find((t) => t.id === taskId);
  const detail = useTaskDetail(taskId);
  const comments = useComments(taskId);

  const update = useBoardMutation(updateTaskAction, (current, { changes }) =>
    patchTask(current, taskId, toBoardPatch(current, changes)),
  );
  async function save(changes: TaskChanges) {
    await update.run({ orgId, taskId, changes });
    await queryClient.invalidateQueries({ queryKey: taskKey(taskId) });
  }

  if (!task) {
    return (
      <div className="grid gap-2 p-6">
        <SheetTitle>Task not found</SheetTitle>
        <SheetDescription>It may have been deleted by someone else.</SheetDescription>
      </div>
    );
  }

  const createdIt = (detail.data?.createdBy?.id ?? task.createdBy) === userId;
  const deletable = canEdit && canDeleteTask(role, assigned, createdIt);

  return (
    <>
      <div className="grid gap-1 border-b p-6 pr-12">
        <SheetDescription className="text-xs">
          {board.columns.find((c) => c.id === task.columnId)?.name}
        </SheetDescription>
        <TitleField task={task} editable={canEdit} onSave={(title) => void save({ title })} />
      </div>

      <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-4 gap-y-2 border-b p-6 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <StatusField task={task} board={board} editable={canEdit} />
        </dd>
        <dt className="text-muted-foreground">Assignee</dt>
        <dd>
          <Select
            disabled={!canEdit}
            value={task.assignee?.id ?? "none"}
            onValueChange={(value) => void save({ assigneeId: value === "none" ? null : value })}
          >
            <SelectTrigger className="w-full max-w-64" aria-label="Assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">Unassigned</span>
              </SelectItem>
              {board.people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  <PersonAvatar person={person} /> {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </dd>
        <dt className="text-muted-foreground">Priority</dt>
        <dd>
          <Select
            disabled={!canEdit}
            value={task.priority}
            onValueChange={(value) => void save({ priority: value as TaskPriority })}
          >
            <SelectTrigger className="w-full max-w-64" aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  <PriorityIcon priority={priority} /> {TASK_PRIORITY_LABELS[priority]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </dd>
        <dt className="text-muted-foreground">Due date</dt>
        <dd>
          <DueDateField
            value={task.dueDate}
            editable={canEdit}
            onChange={(dueDate) => void save({ dueDate })}
          />
        </dd>
        <dt className="self-start pt-1.5 text-muted-foreground">Labels</dt>
        <dd>
          <LabelsField task={task} board={board} editable={canEdit} />
        </dd>
      </dl>

      <div className="grid gap-2 p-6">
        <h3 className="text-sm font-medium">Description</h3>
        {detail.data ? (
          <DescriptionEditor
            value={detail.data.description}
            editable={canEdit}
            onSave={(description) => void save({ description })}
          />
        ) : detail.isError ? (
          <p className="text-sm text-destructive">{detail.error.message}</p>
        ) : (
          <Skeleton className="h-28 w-full" />
        )}
      </div>

      <Tabs defaultValue="comments" className="gap-4 border-t p-6">
        <TabsList variant="line" className="-ml-1.5">
          <TabsTrigger value="comments">
            Comments
            {comments.data && comments.data.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {comments.data.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="comments">
          <TaskComments taskId={taskId} people={board.people} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityFeed
            orgId={orgId}
            filter={{ taskId }}
            empty="Changes to this task will show up here."
          />
        </TabsContent>
      </Tabs>

      <div className="mt-auto flex items-center justify-between gap-4 border-t px-6 py-4 text-xs text-muted-foreground">
        <span>
          {detail.data &&
            `Created${detail.data.createdBy ? ` by ${detail.data.createdBy.name}` : ""} on ${formatDate(new Date(detail.data.createdAt))}`}
        </span>
        {deletable && <DeleteTask task={task} onDeleted={onClose} />}
      </div>
    </>
  );
}

/** Mirrors task changes onto the board's card, so it updates before the server answers. */
function toBoardPatch(board: Board, changes: TaskChanges): Partial<BoardTask> {
  const { description, assigneeId, ...rest } = changes;
  const patch: Partial<BoardTask> = { ...rest };
  if (description !== undefined) patch.hasDescription = description !== null;
  if (assigneeId !== undefined) {
    patch.assignee = board.people.find((p) => p.id === assigneeId) ?? null;
  }
  return patch;
}

function TitleField({
  task,
  editable,
  onSave,
}: {
  task: BoardTask;
  editable: boolean;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(task.title);
  if (!editable) return <SheetTitle className="text-lg">{task.title}</SheetTitle>;

  function commit() {
    const title = value.trim();
    if (!title) setValue(task.title);
    else if (title !== task.title) onSave(title);
  }

  return (
    <>
      <SheetTitle className="sr-only">{task.title}</SheetTitle>
      <Textarea
        value={value}
        rows={1}
        maxLength={200}
        aria-label="Title"
        className="-mx-2 field-sizing-content min-h-0 resize-none border-transparent px-2 py-1 text-lg font-semibold shadow-none hover:border-input dark:bg-transparent"
        onChange={(event) => {
          setValue(event.target.value.replace(/\n/g, ""));
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") setValue(task.title);
        }}
      />
    </>
  );
}

function StatusField({
  task,
  board,
  editable,
}: {
  task: BoardTask;
  board: Board;
  editable: boolean;
}) {
  const { orgId } = useBoardContext();
  const move = useBoardMutation(moveTaskAction, applyMove);
  const grouped = tasksByColumn(board);

  return (
    <Select
      disabled={!editable}
      value={task.columnId}
      onValueChange={(columnId) => {
        // Moving to another column puts the task at its end.
        const afterTaskId = grouped.get(columnId)?.at(-1)?.id ?? null;
        void move.run({ orgId, taskId: task.id, columnId, afterTaskId });
      }}
    >
      <SelectTrigger className="w-full max-w-64" aria-label="Status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {board.columns.map((column) => (
          <SelectItem key={column.id} value={column.id}>
            {column.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DueDateField({
  value,
  editable,
  onChange,
}: {
  value: string | null;
  editable: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={!editable}
            className={cn(
              "w-full max-w-64 justify-start font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarDays aria-hidden />
            {value ? formatDueDate(value, true) : "No due date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              setOpen(false);
              onChange(date ? format(date, "yyyy-MM-dd") : null);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && editable && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onChange(null);
          }}
        >
          <X aria-hidden />
          <span className="sr-only">Clear due date</span>
        </Button>
      )}
    </div>
  );
}

function LabelsField({
  task,
  board,
  editable,
}: {
  task: BoardTask;
  board: Board;
  editable: boolean;
}) {
  const { orgId, projectId } = useBoardContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const selected = new Set(task.labels.map((l) => l.id));
  const setLabels = useBoardMutation(setTaskLabelsAction, (current, { labelIds }) =>
    patchTask(current, task.id, {
      labels: current.labels.filter((l) => labelIds.includes(l.id)),
    }),
  );
  const createLabel = useBoardMutation(createLabelAction);

  async function toggle(labelId: string) {
    const next = new Set(selected);
    if (next.has(labelId)) next.delete(labelId);
    else next.add(labelId);
    await setLabels.run({ orgId, taskId: task.id, labelIds: [...next] });
  }

  async function create() {
    const name = search.trim();
    setSearch("");
    const label = await createLabel.run({ orgId, name });
    if (!label) return;
    queryClient.setQueryData<Board>(boardKey(projectId), (current) =>
      current && !current.labels.some((l) => l.id === label.id)
        ? {
            ...current,
            labels: [...current.labels, label].sort((a, b) => a.name.localeCompare(b.name)),
          }
        : current,
    );
    if (!selected.has(label.id)) await toggle(label.id);
  }

  const exactMatch = board.labels.some((l) => l.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.labels.map((label) => (
        <LabelChip key={label.id} label={label} className="h-6" />
      ))}
      {editable && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              {task.labels.length === 0 ? (
                <>
                  <Tag aria-hidden /> Add labels
                </>
              ) : (
                <>
                  <Plus aria-hidden /> <span className="sr-only">Edit labels</span>
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Find or create a label"
                value={search}
                onValueChange={setSearch}
                maxLength={30}
              />
              <CommandList>
                <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                  {search.trim() ? "No matching labels." : "No labels yet."}
                </CommandEmpty>
                {board.labels.length > 0 && (
                  <CommandGroup>
                    {board.labels.map((label) => (
                      <CommandItem
                        key={label.id}
                        value={label.name}
                        data-checked={selected.has(label.id)}
                        onSelect={() => void toggle(label.id)}
                      >
                        <span
                          className={cn("size-2 rounded-full", labelDot(label.color))}
                          aria-hidden
                        />
                        {label.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {search.trim() && !exactMatch && (
                  <CommandGroup forceMount>
                    <CommandItem
                      forceMount
                      value={`create:${search}`}
                      onSelect={() => void create()}
                    >
                      <Plus aria-hidden /> Create “{search.trim()}”
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {!editable && task.labels.length === 0 && <span className="text-muted-foreground">None</span>}
    </div>
  );
}

function DeleteTask({ task, onDeleted }: { task: BoardTask; onDeleted: () => void }) {
  const { orgId } = useBoardContext();
  const remove = useBoardMutation(deleteTaskAction, (board) => ({
    ...board,
    tasks: board.tasks.filter((t) => t.id !== task.id),
  }));

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 aria-hidden /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            “{task.title}” and its description will be deleted. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onDeleted();
              void remove.run({ orgId, taskId: task.id });
            }}
          >
            Delete task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
