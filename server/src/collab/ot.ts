export type OpType = "insert" | "delete";

export interface TextOperation {
  type: OpType;
  index: number;
  text?: string;
  length?: number;
}

export function applyOperation(text: string, op: TextOperation): string {
  const safeIndex = Math.max(0, Math.min(op.index, text.length));
  if (op.type === "insert") {
    const insertText = op.text ?? "";
    return text.slice(0, safeIndex) + insertText + text.slice(safeIndex);
  }

  const deleteLength = op.length ?? 0;
  if (deleteLength < 0) {
    throw new Error("Delete length must be non-negative");
  }
  const start = safeIndex;
  const end = Math.min(text.length, start + deleteLength);
  return text.slice(0, start) + text.slice(end);
}

export function applyOperations(text: string, ops: TextOperation[]): string {
  return ops.reduce((current, op) => applyOperation(current, op), text);
}

function compareTieBreaker(tieBreakerId?: string, otherId?: string) {
  if (!tieBreakerId || !otherId) return 0;
  return tieBreakerId < otherId ? -1 : tieBreakerId > otherId ? 1 : 0;
}

export function transform(
  opA: TextOperation,
  opB: TextOperation,
  opts?: { tieBreakerId?: string; otherId?: string },
): { aPrime: TextOperation; bPrime: TextOperation } {
  const insertLenA = opA.text?.length ?? 0;
  const insertLenB = opB.text?.length ?? 0;
  const deleteLenA = opA.length ?? 0;
  const deleteLenB = opB.length ?? 0;
  const tie = compareTieBreaker(opts?.tieBreakerId, opts?.otherId);
  const aBeforeB =
    opA.index < opB.index || (opA.index === opB.index && tie <= 0);

  // Insert vs Insert
  if (opA.type === "insert" && opB.type === "insert") {
    if (aBeforeB) {
      return {
        aPrime: { ...opA },
        bPrime: { ...opB, index: opB.index + insertLenA },
      };
    }
    return {
      aPrime: { ...opA, index: opA.index + insertLenB },
      bPrime: { ...opB },
    };
  }

  // Insert vs Delete
  if (opA.type === "insert" && opB.type === "delete") {
    const delEnd = opB.index + deleteLenB;
    let aPrime = { ...opA };
    if (opA.index > delEnd) {
      aPrime = { ...aPrime, index: opA.index - deleteLenB };
    } else if (opA.index >= opB.index) {
      aPrime = { ...aPrime, index: opB.index };
    }
    const bPrime =
      opA.index <= opB.index
        ? { ...opB, index: opB.index + insertLenA }
        : { ...opB };
    return { aPrime, bPrime };
  }

  // Delete vs Insert
  if (opA.type === "delete" && opB.type === "insert") {
    const { aPrime: bPrime, bPrime: aPrime } = transform(
      opB,
      opA,
      opts ? { tieBreakerId: opts.otherId, otherId: opts.tieBreakerId } : undefined,
    );
    return { aPrime, bPrime };
  }

  // Delete vs Delete
  if (opA.type === "delete" && opB.type === "delete") {
    const aStart = opA.index;
    const aEnd = opA.index + deleteLenA;
    const bStart = opB.index;
    const bEnd = opB.index + deleteLenB;

    // Non-overlapping
    if (aEnd <= bStart) {
      return {
        aPrime: { ...opA },
        bPrime: { ...opB, index: opB.index - deleteLenA },
      };
    }
    if (bEnd <= aStart) {
      return {
        aPrime: { ...opA, index: opA.index - deleteLenB },
        bPrime: { ...opB },
      };
    }

    // Overlap
    const overlapStart = Math.max(aStart, bStart);
    const overlapEnd = Math.min(aEnd, bEnd);
    const overlap = overlapEnd - overlapStart;

    const aPrime: TextOperation = {
      ...opA,
      index: Math.min(aStart, bStart),
      length: Math.max(0, deleteLenA - overlap),
    };

    const bPrime: TextOperation = {
      ...opB,
      index: Math.min(aStart, bStart),
      length: Math.max(0, deleteLenB - overlap),
    };

    return { aPrime, bPrime };
  }

  return { aPrime: opA, bPrime: opB };
}
