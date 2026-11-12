"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Italic, List, ListOrdered, Strikethrough } from "lucide-react";
import { useEffect, useRef } from "react";

import type { TaskDescription } from "@/lib/projects";
import { cn } from "@/lib/utils";

const SAVE_DELAY_MS = 800;

/**
 * The task description, edited in place. Saves shortly after typing stops and when the editor
 * loses focus. Content is the editor's JSON, so nothing is ever rendered as raw HTML.
 */
export function DescriptionEditor({
  value,
  editable,
  onSave,
}: {
  value: TaskDescription;
  editable: boolean;
  onSave: (value: TaskDescription) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaved = useRef(JSON.stringify(value));
  // The latest content, so edits still waiting for the timer are saved when the sheet closes.
  const latest = useRef<TaskDescription>(value);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Placeholder.configure({ placeholder: editable ? "Add a description…" : "No description." }),
    ],
    content: (value as JSONContent | null) ?? "",
    editorProps: {
      attributes: {
        "aria-label": "Description",
        class: "prose-task min-h-28 rounded-lg px-3 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      latest.current = current.isEmpty ? null : (current.getJSON() as TaskDescription);
      clearTimeout(timer.current);
      timer.current = setTimeout(save, SAVE_DELAY_MS);
    },
    onBlur: () => {
      clearTimeout(timer.current);
      save();
    },
  });

  function save() {
    const serialized = JSON.stringify(latest.current);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;
    onSaveRef.current(latest.current);
  }

  // Someone else changed it: show their version, unless this person is typing in it.
  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (!editor || editor.isFocused || serialized === lastSaved.current) return;
    clearTimeout(timer.current);
    lastSaved.current = serialized;
    latest.current = value;
    editor.commands.setContent((value as JSONContent | null) ?? "", { emitUpdate: false });
  }, [editor, value]);

  // Save edits still waiting for the timer when the sheet closes.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      save();
    },
    [],
  );

  if (!editor) return <div className="min-h-28 rounded-lg border" aria-busy="true" />;

  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: "bold",
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: "italic",
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: "strike",
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Code",
      icon: Code,
      active: "code",
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "Bulleted list",
      icon: List,
      active: "bulletList",
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: "orderedList",
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div className="rounded-lg border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {editable && (
        <div role="toolbar" aria-label="Formatting" className="flex gap-0.5 border-b p-1">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={editor.isActive(tool.active)}
              onMouseDown={(event) => {
                // Keep the selection in the editor.
                event.preventDefault();
              }}
              onClick={tool.run}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                editor.isActive(tool.active) && "bg-muted text-foreground",
              )}
            >
              <tool.icon className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
