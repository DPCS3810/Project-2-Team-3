export type OpType = "insert" | "delete";

export interface TextOperation {
  type: OpType;
  index: number;
  text?: string;
  length?: number;
}

export function applyOperation(text: string, op: TextOperation): string {
  if (op.type === "insert") {
    const insertText = op.text ?? "";
    return text.slice(0, op.index) + insertText + text.slice(op.index);
  }
  const len = op.length ?? 0;
  return text.slice(0, op.index) + text.slice(op.index + len);
}

export function applyOperations(text: string, ops: TextOperation[]): string {
  return ops.reduce((t, op) => applyOperation(t, op), text);
}
