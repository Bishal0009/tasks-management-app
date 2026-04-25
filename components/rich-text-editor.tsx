"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Strikethrough, List } from "lucide-react";

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Add content...",
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: value || "",
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== undefined) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {editable && (
        <div className="flex gap-1 p-2 border-b bg-muted/40">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("bold") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("italic") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("strike") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("bulletList") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive("orderedList") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            title="Ordered List"
          >
            <List className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="min-h-[120px] p-3 prose prose-sm max-w-none focus:outline-none [&_.is-empty::before]:text-muted-foreground [&_.is-empty::before]:content-[attr(data-placeholder)]"
        data-placeholder={editable ? placeholder : ""}
      />
    </div>
  );
}
