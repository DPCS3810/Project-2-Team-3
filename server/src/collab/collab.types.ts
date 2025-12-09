import { TextOperation } from "./ot";

export interface ApplyUserOperationsParams {
  userId: string;
  documentId: string;
  baseVersion: number;
  operations: TextOperation[];
}

export interface DocumentState {
  documentId: string;
  content: string;
  version: number;
}
