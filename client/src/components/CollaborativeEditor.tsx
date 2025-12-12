import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../auth/AuthContext";
import { applyOperations } from "../collab/ot";
import type { TextOperation } from "../collab/ot";

interface Props {
  documentId: string;
  onSelectionChange?: (pos: { start: number; end: number }) => void;
  onSaveStatusChange?: (status: { saving: boolean; lastSaved?: number }) => void;
  onContentChange?: (content: string) => void;
}

interface InitialStatePayload {
  documentId: string;
  content: string;
  version: number;
}

interface OpAppliedPayload {
  documentId: string;
  userId: string;
  operations: TextOperation[];
  version: number;
}

export function CollaborativeEditor({ documentId, onSelectionChange, onSaveStatusChange, onContentChange }: Props) {
  const { token, user } = useAuth();
  const [content, setContent] = useState("");
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<Record<string, { email?: string }>>({});
  const [cursors, setCursors] = useState<Record<string, { email?: string; position?: number; selectionStart?: number; selectionEnd?: number }>>({});

  const prevContentRef = useRef("");
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | undefined>(user?.id);
  const versionRef = useRef(0);
  const pendingOpsRef = useRef(0);
  const pendingQueueRef = useRef<
    { opId: string; ops: TextOperation[]; baseVersion: number }[]
  >([]);
  const undoStack = useRef<{ ops: TextOperation[]; inverseOps: TextOperation[] }[]>([]);
  const redoStack = useRef<{ ops: TextOperation[]; inverseOps: TextOperation[] }[]>([]);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    if (!token) return;

    const socket = io(import.meta.env.VITE_WS_URL || "http://localhost:4000", {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_document", { documentId });
      if (user?.id) {
        setParticipants((current) => ({
          ...current,
          [user.id]: { email: user.email },
        }));
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("initial_state", (payload: InitialStatePayload) => {
      if (payload.documentId !== documentId) return;
      setContent(payload.content);
      setVersion(payload.version);
      versionRef.current = payload.version;
      prevContentRef.current = payload.content;
    });

    socket.on("op_applied", (payload: OpAppliedPayload & { opId?: string }) => {
      if (payload.documentId !== documentId) return;

      const isOwn = userIdRef.current && payload.userId === userIdRef.current;
      if (isOwn && payload.opId) {
        pendingQueueRef.current = pendingQueueRef.current.filter((p) => p.opId !== payload.opId);
      }

      setContent((current) => {
        // If it's our own op and we already applied, just advance version.
        if (isOwn) {
          onContentChange?.(current);
          return current;
        }
        const updated = applyOperations(current, payload.operations);
        prevContentRef.current = updated;
        onContentChange?.(updated);
        return updated;
      });
      setVersion(payload.version);
      versionRef.current = payload.version;
      if (pendingOpsRef.current > 0 && payload.userId === userIdRef.current) {
        pendingOpsRef.current = Math.max(0, pendingOpsRef.current - payload.operations.length);
        onSaveStatusChange?.({
          saving: pendingOpsRef.current > 0,
          lastSaved: Date.now(),
        });
      }
    });

    socket.on(
      "cursor_update",
      (payload: { documentId: string; userId: string; email?: string; cursorPosition?: number; selectionStart?: number; selectionEnd?: number }) => {
        if (payload.documentId !== documentId) return;
        setCursors((current) => ({
          ...current,
          [payload.userId]: {
            email: payload.email,
            position: payload.cursorPosition,
            selectionStart: payload.selectionStart,
            selectionEnd: payload.selectionEnd,
          },
        }));
      },
    );

    socket.on("presence", (payload: { documentId: string; userId: string; email?: string; status: string }) => {
      if (payload.documentId !== documentId) return;
      setParticipants((current) => {
        if (payload.status === "joined") {
          return {
            ...current,
            [payload.userId]: { email: payload.email },
          };
        }
        if (payload.status === "left") {
          const updated = { ...current };
          delete updated[payload.userId];
          return updated;
        }
        return current;
      });
      if (payload.status === "left") {
        setCursors((cur) => {
          const copy = { ...cur };
          delete copy[payload.userId];
          return copy;
        });
      }
    });

    return () => {
      socket.emit("leave_document", { documentId });
      socket.disconnect();
    };
  }, [documentId, token, user?.id]);

  const emitCursor = (start: number, end: number) => {
    onSelectionChange?.({ start, end });
    selectionRef.current = { start, end };
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit("cursor_update", {
      documentId,
      cursorPosition: start,
      selectionStart: start,
      selectionEnd: end,
    });
  };

  const handleChange = (value: string, selectionStart: number, selectionEnd: number) => {
    applyLocalChange(value, selectionStart, selectionEnd, true);
  };

  const applyLocalChange = (
    value: string,
    selectionStart: number,
    selectionEnd: number,
    recordUndo: boolean,
    customOps?: { ops: TextOperation[]; inverseOps: TextOperation[] },
  ) => {
    const previous = prevContentRef.current;
    const { ops, inverseOps } = customOps ?? diffToOperationsWithInverse(previous, value);
    setContent(value);
    onContentChange?.(value);
    prevContentRef.current = value;

    if (recordUndo && ops.length > 0) {
      undoStack.current.push({ ops, inverseOps });
      redoStack.current = [];
    }

    if (ops.length > 0 && socketRef.current && socketRef.current.connected) {
      const baseVersion = versionRef.current;
      const nextVersion = baseVersion + ops.length;
      setVersion(nextVersion);
      versionRef.current = nextVersion;
      pendingOpsRef.current += ops.length;
      onSaveStatusChange?.({ saving: true });
      const opId = crypto.randomUUID();
      pendingQueueRef.current.push({ opId, ops, baseVersion });
      socketRef.current.emit("op", {
        documentId,
        baseVersion,
        operations: ops,
        opId,
      });
    }

    emitCursor(selectionStart, selectionEnd);
  };

  const handleUndo = () => {
    if (undoStack.current.length === 0) return;
    const { ops, inverseOps } = undoStack.current.pop() as { ops: TextOperation[]; inverseOps: TextOperation[] };
    redoStack.current.push({ ops, inverseOps });
    const newContent = applyOperations(prevContentRef.current, inverseOps);
    applyLocalChange(newContent, selectionRef.current.start, selectionRef.current.end, false, {
      ops: inverseOps,
      inverseOps: ops,
    });
  };

  const handleRedo = () => {
    if (redoStack.current.length === 0) return;
    const { ops, inverseOps } = redoStack.current.pop() as { ops: TextOperation[]; inverseOps: TextOperation[] };
    undoStack.current.push({ ops, inverseOps });
    const newContent = applyOperations(prevContentRef.current, ops);
    applyLocalChange(newContent, selectionRef.current.start, selectionRef.current.end, false, { ops, inverseOps });
  };

  return (
    <div className="editor-container">
      <div className="editor-status">
        <span>Connection: {connected ? "Connected" : "Disconnected"}</span>
        <span>Version: {version}</span>
        <span>Participants: {Object.keys(participants).length}</span>
        <div className="presence-chips">
          {Object.entries(participants).map(([uid, info]) => (
            <span key={uid} className="presence-chip">
              {info.email || uid}
            </span>
          ))}
        </div>
        <div className="editor-actions">
          <button type="button" onClick={handleUndo}>
            Undo
          </button>
          <button type="button" onClick={handleRedo}>
            Redo
          </button>
        </div>
      </div>
      <textarea
        className="editor-textarea"
        value={content}
        onChange={(e) => handleChange(e.target.value, e.target.selectionStart, e.target.selectionEnd)}
        onSelect={(e) => {
          const start = (e.target as HTMLTextAreaElement).selectionStart;
          const end = (e.target as HTMLTextAreaElement).selectionEnd;
          emitCursor(start, end);
        }}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key.toLowerCase() === "z") {
            e.preventDefault();
            handleUndo();
          } else if (e.ctrlKey && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
            e.preventDefault();
            handleRedo();
          }
        }}
        placeholder="Start typing..."
      />
      <div className="cursors-panel">
        {Object.entries(cursors).map(([uid, info]) => (
          <div key={uid} className="cursor-chip">
            <span className="cursor-dot" />
            <span>{info.email || uid}</span>
            {typeof info.position === "number" ? <span> @ {info.position}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function diffToOperationsWithInverse(prev: string, next: string): {
  ops: TextOperation[];
  inverseOps: TextOperation[];
} {
  if (prev === next) return { ops: [], inverseOps: [] };

  const prefixLen = longestCommonPrefix(prev, next);
  const suffixLen = longestCommonSuffix(prev, next, prefixLen);

  const prevMiddle = prev.slice(prefixLen, prev.length - suffixLen);
  const nextMiddle = next.slice(prefixLen, next.length - suffixLen);

  const ops: TextOperation[] = [];
  const inverseOps: TextOperation[] = [];

  if (prevMiddle.length > 0) {
    ops.push({
      type: "delete",
      index: prefixLen,
      length: prevMiddle.length,
    });
    inverseOps.unshift({
      type: "insert",
      index: prefixLen,
      text: prevMiddle,
    });
  }

  if (nextMiddle.length > 0) {
    ops.push({
      type: "insert",
      index: prefixLen,
      text: nextMiddle,
    });
    inverseOps.unshift({
      type: "delete",
      index: prefixLen,
      length: nextMiddle.length,
    });
  }

  return { ops, inverseOps };
}

function longestCommonPrefix(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) {
    i += 1;
  }
  return i;
}

function longestCommonSuffix(a: string, b: string, skipPrefix: number) {
  const max = Math.min(a.length, b.length) - skipPrefix;
  let i = 0;
  while (
    i < max &&
    a[a.length - 1 - i] === b[b.length - 1 - i] &&
    a.length - 1 - i >= skipPrefix &&
    b.length - 1 - i >= skipPrefix
  ) {
    i += 1;
  }
  return i;
}
