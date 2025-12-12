export interface CreateDocumentBody {
  title: string;
  description?: string;
}

export interface UpdateDocumentBody {
  title?: string;
  description?: string;
  content?: string;
}

export interface UpsertPermissionBody {
  userId: string;
  role: "VIEW" | "COMMENT" | "EDIT";
}
