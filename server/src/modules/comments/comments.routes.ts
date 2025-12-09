import { Router } from "express";
import { PermissionRole } from "@prisma/client";
import { authMiddleware } from "../../middleware/authMiddleware";
import { HttpError } from "../../utils/errors";
import { requireDocumentAccess } from "../documents/documents.service";
import { addComment, deleteComment, listComments } from "./comments.store";

const commentsRouter = Router({ mergeParams: true });

commentsRouter.use(authMiddleware);

commentsRouter.get("/", async (req, res) => {
  const userId = req.user?.id;
  const { id: documentId } = req.params as { id: string };
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    await requireDocumentAccess(userId, documentId, PermissionRole.VIEW);
    const comments = listComments(documentId);
    return res.json({ comments });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

commentsRouter.post("/", async (req, res) => {
  const userId = req.user?.id;
  const email = req.user?.email;
  const { id: documentId } = req.params as { id: string };
  const { text, position } = req.body || {};
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    await requireDocumentAccess(userId, documentId, PermissionRole.COMMENT);
    const comment = addComment({ documentId, userId, email, text, position });
    return res.status(201).json({ comment });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

commentsRouter.delete("/:commentId", async (req, res) => {
  const userId = req.user?.id;
  const { id: documentId, commentId } = req.params as { id: string; commentId: string };
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    await requireDocumentAccess(userId, documentId, PermissionRole.COMMENT);
    const removed = deleteComment(documentId, commentId, userId);
    if (!removed) {
      return res.status(404).json({ error: "Comment not found" });
    }
    return res.status(204).send();
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { commentsRouter };
