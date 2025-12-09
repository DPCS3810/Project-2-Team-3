import { applyOperation, applyOperations, transform, TextOperation } from "../src/collab/ot";

describe("OT core", () => {
  it("applies insert and delete operations", () => {
    const initial = "Hello";
    const insertOp: TextOperation = { type: "insert", index: 5, text: " World" };
    const afterInsert = applyOperation(initial, insertOp);
    expect(afterInsert).toBe("Hello World");

    const deleteOp: TextOperation = { type: "delete", index: 0, length: 5 };
    const afterDelete = applyOperation(afterInsert, deleteOp);
    expect(afterDelete).toBe(" World");
  });

  it("applies multiple operations in order", () => {
    const initial = "abc";
    const ops: TextOperation[] = [
      { type: "insert", index: 3, text: "d" },
      { type: "delete", index: 1, length: 1 },
    ];
    const result = applyOperations(initial, ops);
    expect(result).toBe("acd");
  });

  it("transform handles insert vs insert with different indices", () => {
    const a: TextOperation = { type: "insert", index: 1, text: "A" };
    const b: TextOperation = { type: "insert", index: 3, text: "B" };
    const { aPrime, bPrime } = transform(a, b);

    const start = "xyz";
    const res1 = applyOperations(start, [a, bPrime]);
    const res2 = applyOperations(start, [b, aPrime]);
    expect(res1).toBe(res2);
  });

  it("transform handles insert vs insert with same index using tie-breaker", () => {
    const a: TextOperation = { type: "insert", index: 1, text: "A" };
    const b: TextOperation = { type: "insert", index: 1, text: "B" };
    const { aPrime, bPrime } = transform(a, b, { tieBreakerId: "user-1", otherId: "user-2" });

    const start = "xyz";
    const res1 = applyOperations(start, [a, bPrime]);
    const res2 = applyOperations(start, [b, aPrime]);
    expect(res1).toBe(res2);
  });

  it("transform handles insert vs delete", () => {
    const a: TextOperation = { type: "insert", index: 2, text: "A" };
    const b: TextOperation = { type: "delete", index: 1, length: 1 };
    const { aPrime, bPrime } = transform(a, b);

    const start = "abcd";
    const res1 = applyOperations(start, [a, bPrime]);
    const res2 = applyOperations(start, [b, aPrime]);
    expect(res1).toBe(res2);
  });

  it("transform handles delete vs delete", () => {
    const a: TextOperation = { type: "delete", index: 1, length: 2 };
    const b: TextOperation = { type: "delete", index: 2, length: 1 };
    const { aPrime, bPrime } = transform(a, b);

    const start = "abcdef";
    const res1 = applyOperations(start, [a, bPrime]);
    const res2 = applyOperations(start, [b, aPrime]);
    expect(res1).toBe(res2);
  });
});
