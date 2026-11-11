"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/projects";
import type { Board, BoardTask } from "@/server/services/board";

import { labelDot } from "./label-chip";
import { PriorityIcon } from "./task-meta";

export interface TaskFilters {
  search: string;
  /** A user id, "me", "none" or "any". */
  assignee: string;
  priority: TaskPriority | "any";
  label: string;
}

export const NO_FILTERS: TaskFilters = {
  search: "",
  assignee: "any",
  priority: "any",
  label: "any",
};

export function isFiltering(filters: TaskFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.assignee !== "any" ||
    filters.priority !== "any" ||
    filters.label !== "any"
  );
}

export function filterTasks(tasks: BoardTask[], filters: TaskFilters, userId: string) {
  const search = filters.search.trim().toLowerCase();
  const assignee = filters.assignee === "me" ? userId : filters.assignee;
  return tasks.filter(
    (task) =>
      (!search || task.title.toLowerCase().includes(search)) &&
      (assignee === "any" ||
        (assignee === "none" ? task.assignee === null : task.assignee?.id === assignee)) &&
      (filters.priority === "any" || task.priority === filters.priority) &&
      (filters.label === "any" || task.labels.some((l) => l.id === filters.label)),
  );
}

export function FilterBar({
  board,
  filters,
  onChange,
}: {
  board: Board;
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}) {
  const set = (patch: Partial<TaskFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter tasks">
      <InputGroup className="h-8 w-full sm:w-56">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          value={filters.search}
          placeholder="Search tasks"
          aria-label="Search tasks"
          onChange={(event) => {
            set({ search: event.target.value });
          }}
        />
      </InputGroup>

      <Select
        value={filters.assignee}
        onValueChange={(assignee) => {
          set({ assignee });
        }}
      >
        <SelectTrigger aria-label="Assignee" className="min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any assignee</SelectItem>
          <SelectItem value="me">Assigned to me</SelectItem>
          <SelectItem value="none">Unassigned</SelectItem>
          {board.people.length > 0 && <SelectSeparator />}
          {board.people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority}
        onValueChange={(priority) => {
          set({ priority: priority as TaskFilters["priority"] });
        }}
      >
        <SelectTrigger aria-label="Priority" className="min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any priority</SelectItem>
          {TASK_PRIORITIES.map((priority) => (
            <SelectItem key={priority} value={priority}>
              <PriorityIcon priority={priority} /> {TASK_PRIORITY_LABELS[priority]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {board.labels.length > 0 && (
        <Select
          value={filters.label}
          onValueChange={(label) => {
            set({ label });
          }}
        >
          <SelectTrigger aria-label="Label" className="min-w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any label</SelectItem>
            {board.labels.map((label) => (
              <SelectItem key={label.id} value={label.id}>
                <span className={`size-2 rounded-full ${labelDot(label.color)}`} aria-hidden />
                {label.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isFiltering(filters) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(NO_FILTERS);
          }}
        >
          <X aria-hidden /> Clear
        </Button>
      )}
    </div>
  );
}
