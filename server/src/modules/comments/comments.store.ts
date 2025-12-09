import { randomUUID } from "crypto";

export interface CommentEntry {
  id: string;
  documentId: string;
  userId: string;
  email?: string;
  text: string;
  position?: number;
  createdAt: Date;
}

const commentsByDoc = new Map<string, CommentEntry[]>();

export function listComments(documentId: string): CommentEntry[] {
  return commentsByDoc.get(documentId) ?? [];
}

export function addComment(params: {
  documentId: string;
  userId: string;
  email?: string;
  text: string;
  position?: number;
}): CommentEntry {
  const entry: CommentEntry = {
    id: randomUUID(),
    documentId: params.documentId,
    userId: params.userId,
    email: params.email,
    text: params.text,
    position: params.position,
    createdAt: new Date(),
  };
  const current = commentsByDoc.get(params.documentId) ?? [];
  commentsByDoc.set(params.documentId, [entry, ...current]);
  return entry;
}

export function deleteComment(documentId: string, commentId: string, requesterId: string): boolean {
  const current = commentsByDoc.get(documentId);
  if (!current) return false;
  const next = current.filter((c) => !(c.id === commentId && c.userId === requesterId));
  commentsByDoc.set(documentId, next);
  return next.length !== current.length;
}
