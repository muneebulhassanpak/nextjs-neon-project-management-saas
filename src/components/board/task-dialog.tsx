"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { ActivityFeed } from "@/components/activity/activity-feed";
import { PersonAvatar } from "@/components/projects/people";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/projects";
import { canDeleteTask } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  createLabelAction,
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
import { TaskViewers } from "./presence";
import { TaskChecklist } from "./task-checklist";
import { CAPTURES_ESCAPE, TaskComments, useComments } from "./task-comments";
import { formatDueDate, PriorityIcon } from "./task-meta";

import type { PresenceEntry } from "@realtime/protocol";

/** Whether a key press is someone typing (so j/k shouldn't move to another task). */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, [role=combobox]") !== null)
  );
}

/**
 * A task, opened in a large modal: the writing (title, description, checklist, comments) on the
 * left, its properties on the right. On phones it fills the screen in one column.
 */
export function TaskDialog({
  taskId,
  board,
  order,
  viewers,
  onOpen,
  onClose,
  onDelete,
}: {
  taskId: string | null;
  board: Board;
  /** The tasks in the order the board shows them, for Previous and Next. */
  order: string[];
  /** Others with this task open. */
  viewers: PresenceEntry[];
  onOpen: (taskId: string) => void;
  onClose: () => void;
  /** Deletes the task (with an Undo toast). */
  onDelete: (task: BoardTask) => void;
}) {
  const index = taskId ? order.indexOf(taskId) : -1;
  const previous = index > 0 ? order[index - 1] : undefined;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : undefined;

  return (
    <Dialog
      open={taskId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[min(88dvh,880px)] sm:max-w-[calc(100%-3rem)] sm:rounded-xl lg:max-w-5xl"
        // Focus the modal itself, not its first button (which would pop its tooltip open).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        onEscapeKeyDown={(event) => {
          // Escape first closes the mention list or cancels a comment edit.
          if (event.target instanceof Element && event.target.closest(`[${CAPTURES_ESCAPE}]`)) {
            event.preventDefault();
          }
        }}
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
          const to = event.key === "j" ? next : event.key === "k" ? previous : undefined;
          if (to) {
            event.preventDefault();
            onOpen(to);
          }
        }}
      >
        {taskId && (
          <TaskPanel
            key={taskId}
            taskId={taskId}
            board={board}
            viewers={viewers}
            position={index >= 0 ? { index, count: order.length } : null}
            onPrevious={
              previous
                ? () => {
                    onOpen(previous);
                  }
                : undefined
            }
            onNext={
              next
                ? () => {
                    onOpen(next);
                  }
                : undefined
            }
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NavButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={!onClick} onClick={onClick}>
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <kbd className="ml-1 font-mono">{shortcut}</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function TaskPanel({
  taskId,
  board,
  viewers,
  position,
  onPrevious,
  onNext,
  onDelete,
}: {
  taskId: string;
  board: Board;
  viewers: PresenceEntry[];
  /** Where this task is among the ones on the board, if it's shown there. */
  position: { index: number; count: number } | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onDelete: (task: BoardTask) => void;
}) {
  const { orgId, userId, role, assigned, canEdit, projectName } = useBoardContext();
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

  const column = task && board.columns.find((c) => c.id === task.columnId)?.name;
  const toolbar = (
    <div className="flex items-center gap-2 border-b py-2 pr-2 pl-4 sm:pl-6">
      <DialogDescription className="flex min-w-0 flex-1 items-center gap-1 text-xs">
        <span className="truncate">{projectName}</span>
        {column && (
          <>
            <ChevronRight className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{column}</span>
          </>
        )}
      </DialogDescription>
      <TaskViewers viewers={viewers} />
      {position && (
        <div className="flex items-center gap-0.5">
          <span className="mr-1 hidden text-xs text-muted-foreground tabular-nums sm:inline">
            {position.index + 1} of {position.count}
          </span>
          <NavButton label="Previous task" shortcut="K" onClick={onPrevious}>
            <ChevronUp aria-hidden />
          </NavButton>
          <NavButton label="Next task" shortcut="J" onClick={onNext}>
            <ChevronDown aria-hidden />
          </NavButton>
        </div>
      )}
      <DialogClose asChild>
        <Button variant="ghost" size="icon-sm">
          <X aria-hidden />
          <span className="sr-only">Close</span>
        </Button>
      </DialogClose>
    </div>
  );

  if (!task) {
    return (
      <>
        {toolbar}
        <div className="grid gap-2 p-6">
          <DialogTitle>Task not found</DialogTitle>
          <p className="text-sm text-muted-foreground">It may have been deleted by someone else.</p>
        </div>
      </>
    );
  }

  const createdIt = (detail.data?.createdBy?.id ?? task.createdBy) === userId;
  const deletable = canEdit && canDeleteTask(role, assigned, createdIt);

  return (
    <>
      {toolbar}
      {/* Phones: one scrolling column, properties right after the title. Wider: two columns
          that scroll on their own. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_17rem] md:overflow-hidden">
        <div className="contents md:block md:overflow-y-auto">
          <div className="order-1 px-4 pt-5 sm:px-8 sm:pt-7">
            <TitleField task={task} editable={canEdit} onSave={(title) => void save({ title })} />
          </div>

          <div className="order-3 grid gap-8 px-4 py-6 sm:px-8">
            <section className="grid gap-2" aria-label="Description">
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
            </section>

            {detail.data && (detail.data.checklist.length > 0 || canEdit) && (
              <TaskChecklist taskId={taskId} items={detail.data.checklist} editable={canEdit} />
            )}

            <Tabs defaultValue="comments" className="gap-4 border-t pt-6">
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
          </div>
        </div>

        <aside
          aria-label="Details"
          className="order-2 flex flex-col gap-6 border-y bg-muted/30 px-4 py-5 sm:px-8 md:overflow-y-auto md:border-y-0 md:border-l md:px-5"
        >
          <dl className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm md:grid-cols-1 md:gap-y-1.5">
            <dt className="text-muted-foreground md:text-xs">Status</dt>
            <dd className="md:mb-3">
              <StatusField task={task} board={board} editable={canEdit} />
            </dd>
            <dt className="text-muted-foreground md:text-xs">Assignee</dt>
            <dd className="md:mb-3">
              <Select
                disabled={!canEdit}
                value={task.assignee?.id ?? "none"}
                onValueChange={(value) =>
                  void save({ assigneeId: value === "none" ? null : value })
                }
              >
                <SelectTrigger className="w-full" aria-label="Assignee">
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
            <dt className="text-muted-foreground md:text-xs">Priority</dt>
            <dd className="md:mb-3">
              <Select
                disabled={!canEdit}
                value={task.priority}
                onValueChange={(value) => void save({ priority: value as TaskPriority })}
              >
                <SelectTrigger className="w-full" aria-label="Priority">
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
            <dt className="text-muted-foreground md:text-xs">Due date</dt>
            <dd className="md:mb-3">
              <DueDateField
                value={task.dueDate}
                editable={canEdit}
                onChange={(dueDate) => void save({ dueDate })}
              />
            </dd>
            <dt className="self-start pt-1.5 text-muted-foreground md:pt-0 md:text-xs">Labels</dt>
            <dd>
              <LabelsField task={task} board={board} editable={canEdit} />
            </dd>
          </dl>

          <div className="mt-auto grid gap-3 border-t pt-4 text-xs text-muted-foreground">
            {detail.data ? (
              <p>
                Created
                {detail.data.createdBy ? ` by ${detail.data.createdBy.name}` : ""}
                <br />
                on {formatDate(new Date(detail.data.createdAt))}
              </p>
            ) : (
              <Skeleton className="h-8 w-40" />
            )}
            {deletable && (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 justify-start text-destructive hover:text-destructive"
                onClick={() => {
                  onDelete(task);
                }}
              >
                <Trash2 aria-hidden /> Delete task
              </Button>
            )}
          </div>
        </aside>
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
  if (!editable) return <DialogTitle className="text-2xl font-semibold">{task.title}</DialogTitle>;

  function commit() {
    const title = value.trim();
    if (!title) setValue(task.title);
    else if (title !== task.title) onSave(title);
  }

  return (
    <>
      <DialogTitle className="sr-only">{task.title}</DialogTitle>
      <Textarea
        value={value}
        rows={1}
        maxLength={200}
        aria-label="Title"
        className="-mx-2 field-sizing-content min-h-0 resize-none border-transparent px-2 py-1 text-2xl font-semibold tracking-tight shadow-none hover:border-input md:text-2xl dark:bg-transparent"
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
              "min-w-0 flex-1 justify-start font-normal",
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
