"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/format";
import {
  mentionQueryAt,
  splitMentions,
  toEditableText,
  toStoredBody,
  type MentionTarget,
} from "@/lib/mentions";
import { cn } from "@/lib/utils";
import {
  addCommentAction,
  deleteCommentAction,
  editCommentAction,
} from "@/server/actions/collaboration";
import type { ActionResult } from "@/server/errors";
import type { CommentItem } from "@/server/services/comments";
import type { Person } from "@/server/services/projects";

import { useBoardContext } from "./board-data";

type CommentJson = Omit<CommentItem, "createdAt" | "editedAt"> & {
  createdAt: string;
  editedAt: string | null;
};

export const commentsKey = (taskId: string) => ["comments", taskId] as const;

/** Marks an element whose Escape key is handled locally, so the task sheet stays open. */
export const CAPTURES_ESCAPE = "data-captures-escape";

export function useComments(taskId: string) {
  const { orgId } = useBoardContext();
  return useQuery({
    queryKey: commentsKey(taskId),
    queryFn: async () => {
      const response = await fetch(`/api/orgs/${orgId}/tasks/${taskId}/comments`);
      if (!response.ok) throw new Error("Couldn't load the comments.");
      return (await response.json()) as CommentJson[];
    },
  });
}

/** A task's discussion: the comments, oldest first, and a box to add one. */
export function TaskComments({ taskId, people }: { taskId: string; people: Person[] }) {
  const { orgId, canEdit } = useBoardContext();
  const comments = useComments(taskId);
  const refresh = useRefresh(taskId);

  if (comments.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading comments">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (comments.isError) {
    return <p className="text-sm text-destructive">{comments.error.message}</p>;
  }

  return (
    <div className="grid gap-5">
      {comments.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <MessageSquare className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            No comments yet.{canEdit && " Type @ to mention someone."}
          </p>
        </div>
      ) : (
        <ol className="grid gap-5">
          {comments.data.map((comment) => (
            <Comment key={comment.id} taskId={taskId} comment={comment} people={people} />
          ))}
        </ol>
      )}
      {canEdit && (
        <CommentComposer
          people={people}
          submitLabel="Comment"
          placeholder="Write a comment… Type @ to mention someone."
          onSubmit={(body) => refresh(addCommentAction({ orgId, taskId, body }))}
        />
      )}
    </div>
  );
}

/** Runs a comment action, shows its error, and refreshes the comments and the activity. */
function useRefresh(taskId: string) {
  const queryClient = useQueryClient();
  return async (pending: Promise<ActionResult<unknown>>): Promise<boolean> => {
    const result = await pending;
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: commentsKey(taskId) }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
    ]);
    return true;
  };
}

function Comment({
  taskId,
  comment,
  people,
}: {
  taskId: string;
  comment: CommentJson;
  people: Person[];
}) {
  const { orgId, userId, role } = useBoardContext();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = useRefresh(taskId);
  const mine = comment.author?.id === userId;
  const canRemove = mine || role === "owner" || role === "admin";

  return (
    <li className="group/comment flex gap-3">
      {comment.author ? (
        <PersonAvatar person={comment.author} className="mt-0.5" />
      ) : (
        <span className="mt-0.5 size-6 shrink-0 rounded-full bg-muted" />
      )}
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{comment.author?.name ?? "Former member"}</span>
          <time
            dateTime={comment.createdAt}
            title={new Date(comment.createdAt).toLocaleString()}
            className="text-xs text-muted-foreground"
          >
            {formatRelativeTime(new Date(comment.createdAt))}
          </time>
          {comment.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
          {canRemove && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto text-muted-foreground opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal aria-hidden />
                  <span className="sr-only">Comment options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mine && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(true);
                    }}
                  >
                    <Pencil aria-hidden /> Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {editing ? (
          <CommentComposer
            people={people}
            initialBody={comment.body}
            submitLabel="Save"
            autoFocus
            onCancel={() => {
              setEditing(false);
            }}
            onSubmit={async (body) => {
              const ok = await refresh(editCommentAction({ orgId, commentId: comment.id, body }));
              if (ok) setEditing(false);
              return ok;
            }}
          />
        ) : (
          <CommentBody body={comment.body} people={people} />
        )}
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void refresh(deleteCommentAction({ orgId, commentId: comment.id }))}
            >
              Delete comment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function CommentBody({ body, people }: { body: string; people: MentionTarget[] }) {
  return (
    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {splitMentions(body).map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span key={i} className="rounded-sm bg-primary/10 px-0.5 font-medium text-primary">
            @{people.find((p) => p.id === part.userId)?.name ?? "someone"}
          </span>
        ),
      )}
    </p>
  );
}

/**
 * A textarea that suggests people after "@". Picked names are shown as `@Name` and stored as
 * mention tokens. ⌘/Ctrl+Enter submits.
 */
function CommentComposer({
  people,
  initialBody = "",
  submitLabel,
  placeholder,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  people: Person[];
  initialBody?: string;
  submitLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const listId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [initial] = useState(() => toEditableText(initialBody, people));
  const [text, setText] = useState(initial.text);
  const [mentions, setMentions] = useState<MentionTarget[]>(initial.mentions);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(false);

  const matches = query
    ? people.filter((p) => p.name.toLowerCase().includes(query.query.toLowerCase())).slice(0, 6)
    : [];
  const open = matches.length > 0;
  const activeIndex = Math.min(active, matches.length - 1);

  function track(element: HTMLTextAreaElement) {
    setQuery(mentionQueryAt(element.value, element.selectionStart));
    setActive(0);
  }

  function pick(person: MentionTarget) {
    const element = textarea.current;
    if (!element || !query) return;
    const before = text.slice(0, query.start);
    const after = text.slice(element.selectionStart);
    const inserted = `@${person.name} `;
    // Render the new text now, so the caret is placed before the next keystroke arrives.
    flushSync(() => {
      setText(before + inserted + after);
      setMentions((current) =>
        current.some((p) => p.id === person.id) ? current : [...current, person],
      );
      setQuery(null);
    });
    const caret = before.length + inserted.length;
    element.focus();
    element.setSelectionRange(caret, caret);
  }

  async function submit() {
    const body = toStoredBody(text.trim(), mentions);
    if (!body || pending) return;
    setPending(true);
    const ok = await onSubmit(body);
    setPending(false);
    if (ok && !onCancel) {
      setText("");
      setMentions([]);
    }
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="relative">
        <Textarea
          ref={textarea}
          value={text}
          rows={onCancel ? 2 : 3}
          maxLength={5000}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={onCancel ? "Edit comment" : "Comment"}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${String(activeIndex)}` : undefined}
          {...{ [CAPTURES_ESCAPE]: open || onCancel ? "" : undefined }}
          className={cn(
            "field-sizing-content max-h-64 resize-none",
            onCancel ? "min-h-0" : "min-h-16",
          )}
          onChange={(event) => {
            setText(event.target.value);
            track(event.target);
          }}
          onClick={(event) => {
            track(event.currentTarget);
          }}
          onBlur={() => {
            setQuery(null);
          }}
          onKeyDown={(event) => {
            if (open) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActive((activeIndex + step + matches.length) % matches.length);
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                const person = matches[activeIndex];
                if (person) pick(person);
                return;
              }
              if (event.key === "Escape") {
                setQuery(null);
                return;
              }
            }
            if (event.key === "Escape" && onCancel) onCancel();
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="People"
            className="absolute inset-x-0 top-full z-10 mt-1 max-w-72 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {matches.map((person, i) => (
              <li
                key={person.id}
                id={`${listId}-${String(i)}`}
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  i === activeIndex && "bg-accent text-accent-foreground",
                )}
                // Keep focus in the textarea, so the pick lands at the caret.
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onMouseEnter={() => {
                  setActive(i);
                }}
                onClick={() => {
                  pick(person);
                }}
              >
                <PersonAvatar person={person} />
                {person.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
