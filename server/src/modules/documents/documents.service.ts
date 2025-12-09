import { PermissionRole } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { HttpError } from "../../utils/errors";

const roleRank: Record<PermissionRole, number> = {
  VIEW: 1,
  COMMENT: 2,
  EDIT: 3,
};

export async function getAccessibleDocumentsForUser(userId: string) {
  return prisma.document.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { permissions: { some: { userId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      permissions: {
        where: { userId },
        select: { role: true },
      },
    },
  });
}

type RequiredRole = PermissionRole | "OWNER";

export async function requireDocumentAccess(
  userId: string,
  documentId: string,
  requiredRole: RequiredRole,
) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  if (requiredRole === "OWNER") {
    if (document.ownerId !== userId) {
      throw new HttpError(403, "Forbidden");
    }
    return document;
  }

  if (document.ownerId === userId) {
    return document;
  }

  const permission = await prisma.permission.findUnique({
    where: { userId_documentId: { userId, documentId } },
  });

  if (!permission) {
    throw new HttpError(403, "Forbidden");
  }

  const userRank = roleRank[permission.role];
  const neededRank = roleRank[requiredRole];

  if (userRank < neededRank) {
    throw new HttpError(403, "Forbidden");
  }

  return document;
}

export async function createDocument(
  ownerId: string,
  data: { title: string; description?: string },
) {
  return prisma.document.create({
    data: { ...data, ownerId },
  });
}

export async function updateDocument(
  documentId: string,
  data: { title?: string; description?: string },
) {
  return prisma.document.update({
    where: { id: documentId },
    data,
  });
}

export async function duplicateDocument(
  sourceId: string,
  newOwnerId: string,
) {
  const source = await prisma.document.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new HttpError(404, "Document not found");
  }
  return prisma.document.create({
    data: {
      title: `Copy of ${source.title}`,
      description: source.description,
      content: source.content,
      ownerId: newOwnerId,
    },
  });
}

export async function deleteDocument(documentId: string) {
  await prisma.permission.deleteMany({ where: { documentId } });
  await prisma.version.deleteMany({ where: { documentId } });
  await prisma.opLog.deleteMany({ where: { documentId } });
  return prisma.document.delete({ where: { id: documentId } });
}

export async function listPermissions(documentId: string) {
  return prisma.permission.findMany({
    where: { documentId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function upsertPermission(
  documentId: string,
  userId: string,
  role: PermissionRole,
) {
  return prisma.permission.upsert({
    where: { userId_documentId: { userId, documentId } },
    update: { role },
    create: { documentId, userId, role },
  });
}

export async function deletePermission(permissionId: string) {
  return prisma.permission.delete({ where: { id: permissionId } });
}

export async function listVersionsForDocument(documentId: string) {
  return prisma.version.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}
