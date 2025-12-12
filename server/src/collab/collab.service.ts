import { OperationType, PermissionRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireDocumentAccess } from "../modules/documents/documents.service";
import { HttpError } from "../utils/errors";
import { ApplyUserOperationsParams, DocumentState } from "./collab.types";
import { applyOperation, TextOperation } from "./ot";

const SNAPSHOT_INTERVAL = 20;

export async function loadDocumentState(documentId: string): Promise<DocumentState> {
  const document = (await prisma.document.findUnique({
    where: { id: documentId },
  })) as unknown as { id: string; content?: string; currentVersion?: number } | null;

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  return {
    documentId: document.id,
    content: document.content ?? "",
    version: document.currentVersion ?? 0,
  };
}

function buildOpLogEntries(
  documentId: string,
  userId: string,
  baseVersion: number,
  startingContent: string,
  operations: TextOperation[],
) {
  let current = startingContent;
  const entries = operations.map((op, idx) => {
    const payload =
      op.type === "insert"
        ? op.text ?? ""
        : current.slice(op.index, Math.min(current.length, op.index + (op.length ?? 0)));
    const entry = {
      documentId,
      userId,
      baseVersion: baseVersion + idx,
      operationType: op.type === "insert" ? OperationType.INSERT : OperationType.DELETE,
      position: op.index,
      payload,
    };
    current = applyOperation(current, op);
    return entry;
  });
  return { entries, finalContent: current };
}

export async function applyUserOperations(params: ApplyUserOperationsParams) {
  const { userId, documentId, baseVersion, operations } = params;

  await requireDocumentAccess(userId, documentId, PermissionRole.EDIT);

  const document = (await prisma.document.findUnique({
    where: { id: documentId },
  })) as unknown as { id: string; content?: string; currentVersion?: number } | null;

  if (!document) {
    throw new HttpError(404, "Document not found");
  }

  const currentVersion = document.currentVersion ?? 0;

  if (currentVersion !== baseVersion) {
    throw new HttpError(409, "Version mismatch");
  }

  const nextVersion = currentVersion + operations.length;

  const { entries: opLogEntries, finalContent } = buildOpLogEntries(
    documentId,
    userId,
    baseVersion,
    document.content ?? "",
    operations,
  );

  const result = await prisma.$transaction(async (tx) => {
    const updatedDoc = (await tx.document.update({
      where: { id: documentId },
      data: {
        content: finalContent,
        currentVersion: nextVersion,
      } as any,
    })) as { content?: string };

    if (opLogEntries.length > 0) {
      await tx.opLog.createMany({ data: opLogEntries });
    }

    if (nextVersion % SNAPSHOT_INTERVAL === 0) {
      await tx.version.create({
        data: {
          documentId,
          createdById: userId,
          snapshotText: finalContent,
        },
      });
    }

    return updatedDoc;
  });

  return {
    operations,
    version: nextVersion,
    content: result.content,
  };
}
