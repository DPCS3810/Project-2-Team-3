import { Router, Request, Response } from "express";
import { PermissionRole } from "@prisma/client";
import { HttpError } from "../../utils/errors";
import { prisma } from "../../db/prisma";
import {
  createDocument,
  deleteDocument,
  deletePermission,
  getAccessibleDocumentsForUser,
  listPermissions,
  listVersionsForDocument,
  requireDocumentAccess,
  duplicateDocument,
  updateDocument,
  upsertPermission,
} from "./documents.service";
import {
  CreateDocumentBody,
  UpdateDocumentBody,
  UpsertPermissionBody,
} from "./documents.types";

const documentsRouter = Router();

documentsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const documents = await getAccessibleDocumentsForUser(userId);
    return res.json({ documents });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("List documents error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

documentsRouter.post("/", async (req: Request<unknown, unknown, CreateDocumentBody>, res: Response) => {
  const userId = req.user?.id;
  const { title, description } = req.body || {};
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  try {
    const document = await createDocument(userId, { title, description });
    return res.status(201).json({ document });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Create document error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

interface DocumentIdParams {
  id: string;
}

interface PermissionIdParams extends DocumentIdParams {
  permissionId: string;
}

documentsRouter.get("/:id/versions", async (req: Request<DocumentIdParams>, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await requireDocumentAccess(userId, id, PermissionRole.VIEW);
    const versions = await listVersionsForDocument(id);
    return res.json({ versions });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error("List versions error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

documentsRouter.get("/:id", async (req: Request<DocumentIdParams>, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const document = await requireDocumentAccess(userId, id, "VIEW");
    return res.json({ document });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error("Get document error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

documentsRouter.put(
  "/:id",
  async (
    req: Request<DocumentIdParams, unknown, UpdateDocumentBody>,
    res: Response,
  ) => {
    const userId = req.user?.id;
    const { id } = req.params;
  const { title, description } = req.body || {};
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!title && !description) {
    return res.status(400).json({ error: "title or description required" });
  }

    try {
      await requireDocumentAccess(userId, id, PermissionRole.EDIT);
      const document = await updateDocument(id, { title, description });
      return res.json({ document });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      // eslint-disable-next-line no-console
      console.error("Update document error", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

documentsRouter.delete("/:id", async (req: Request<DocumentIdParams>, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await requireDocumentAccess(userId, id, "OWNER");
    await deleteDocument(id);
    return res.status(204).send();
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error("Delete document error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

documentsRouter.get("/:id/permissions", async (req: Request<DocumentIdParams>, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await requireDocumentAccess(userId, id, "OWNER");
    const permissions = await listPermissions(id);
    return res.json({ permissions });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error("List permissions error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

documentsRouter.post(
  "/:id/permissions",
  async (
    req: Request<DocumentIdParams, unknown, UpsertPermissionBody>,
    res: Response,
  ) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { userId: targetUserId, role } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!targetUserId || !role) {
    return res.status(400).json({ error: "userId and role are required" });
  }
  if (!Object.values(PermissionRole).includes(role as PermissionRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

    try {
      await requireDocumentAccess(userId, id, "OWNER");
      const permission = await upsertPermission(id, targetUserId, role as PermissionRole);
      return res.status(200).json({ permission });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      // eslint-disable-next-line no-console
      console.error("Upsert permission error", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

documentsRouter.post("/:id/share", async (req: Request<DocumentIdParams>, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { email, role } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!email || !role) {
    return res.status(400).json({ error: "email and role are required" });
  }
  if (!Object.values(PermissionRole).includes(role as PermissionRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const doc = await requireDocumentAccess(userId, id, PermissionRole.EDIT);

    if (doc.ownerId !== userId) {
      // Only owner or editor allowed; reuse EDIT check above, but ensure not downgrading owner
    }

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const permission = await upsertPermission(id, targetUser.id, role as PermissionRole);
    return res.json({
      permission: {
        id: permission.id,
        userId: targetUser.id,
        email: targetUser.email,
        role: permission.role,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error("Share document error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

documentsRouter.delete(
  "/:id/permissions/:permissionId",
  async (req: Request<PermissionIdParams>, res: Response) => {
    const userId = req.user?.id;
    const { id, permissionId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      await requireDocumentAccess(userId, id, "OWNER");
      const permission = await listPermissions(id);
      const target = permission.find((p) => p.id === permissionId);
      if (!target) {
        return res.status(404).json({ error: "Permission not found" });
      }
      await deletePermission(permissionId);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      // eslint-disable-next-line no-console
      console.error("Delete permission error", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

documentsRouter.post("/:id/duplicate", async (req: Request<DocumentIdParams>, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await requireDocumentAccess(userId, id, PermissionRole.VIEW);
    const newDoc = await duplicateDocument(id, userId);
    return res.status(201).json({ document: newDoc });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    // eslint-disable-next-line no-console
    console.error("Duplicate document error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { documentsRouter };
