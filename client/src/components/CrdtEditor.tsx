import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useAuth } from "../auth/AuthContext";
import { request } from "../api/http";

interface Props {
  documentId: string;
  initialContent?: string;
  onSelectionChange?: (pos: { start: number; end: number }) => void;
  onSaveStatusChange?: (status: { saving: boolean; lastSaved?: number }) => void;
  onContentChange?: (content: string) => void;
}

const COLORS = ["#f87171", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee"];

function pickColor(id?: string) {
  if (!id) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0; // convert to 32bit int
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function CrdtEditor({
  documentId,
  initialContent,
  onSelectionChange,
  onSaveStatusChange,
  onContentChange,
}: Props) {
  const { user, token } = useAuth();

  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  const wsUrl = useMemo(() => {
    const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
    const wsBase = normalized.replace(/^http/, "ws");
    const authToken = token ? `?token=${token}` : "";
    return `${wsBase}/yjs${authToken}`;
  }, []);

  const provider = useMemo(() => new WebsocketProvider(wsUrl, `doc-${documentId}`, ydoc), [
    documentId,
    wsUrl,
    ydoc,
  ]);

  useEffect(
    () => () => {
      provider.destroy();
      ydoc.destroy();
    },
    [provider, ydoc],
  );

  const editor = useEditor({
    autofocus: true,
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      TextStyle,
      // Lists & headings come from StarterKit; toolbar invokes commands.
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user?.name || user?.email || "Anonymous",
          color: pickColor(user?.id),
        },
      }),
    ],
    content: "",
  });

  // Initialize content if doc is empty
  useEffect(() => {
    if (editor && initialContent !== undefined && editor.isEmpty) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Selection updates
  useEffect(() => {
    if (!editor) return;
    const handler = ({ editor: ed }: { editor: typeof editor }) => {
      const { from, to } = ed.state.selection;
      onSelectionChange?.({ start: from, end: to });
    };
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor, onSelectionChange]);

  // Autosave debounce
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const html = editor.getHTML();
      onContentChange?.(html);
      onSaveStatusChange?.({ saving: true });
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(async () => {
        try {
          await request({
            path: `/documents/${documentId}`,
            method: "PUT",
            token,
            body: { content: html },
          });
          onContentChange?.(html);
          onSaveStatusChange?.({ saving: false, lastSaved: Date.now() });
        } catch {
          onSaveStatusChange?.({ saving: false });
        }
      }, 2000);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [documentId, editor, onSaveStatusChange, token]);

  if (!editor) {
    return <div className="page-status">Loading editor...</div>;
  }

  return (
    <div className="crdt-editor">
      <div className="editor-toolbar">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          Underline
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • List
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. List
        </button>
        <select
          onChange={(e) =>
            editor
              ?.chain()
              .focus()
              .setMark("textStyle", { fontSize: e.target.value })
              .run()
          }
          defaultValue="16px"
        >
          {[
            { label: "Small", value: "14px" },
            { label: "Normal", value: "16px" },
            { label: "Large", value: "20px" },
            { label: "Huge", value: "24px" },
          ].map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
