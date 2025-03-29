import { test } from "node:test";
import assert from "node:assert";
import { createJoinOn, OrphanedDataError } from "./index.ts";

type Entry =
  | { type: "topic"; id: string; title: string }
  | { type: "vote"; id: string; value: number }
  | { type: "comment"; id: string; text: string };

const input: Entry[] = [
  { type: "topic", id: "t1", title: "First" },
  { type: "vote", id: "t1-v1", value: 1 },
  { type: "comment", id: "t1-c1", text: "Hi" },
  { type: "topic", id: "t2", title: "Second" },
  { type: "vote", id: "t2-v1", value: 2 },
];

const fieldMap = { vote: "votes", comment: "comments" } as const;

const join = createJoinOn({
  idKey: "id",
  typeKey: "type",
  predicate: (childId: string, parentId: string) =>
    childId.startsWith(parentId),
});

test("it works", () => {
  const result = join(input, "topic", fieldMap);

  assert.deepEqual(result, [
    {
      type: "topic",
      id: "t1",
      title: "First",
      votes: [{ type: "vote", id: "t1-v1", value: 1 }],
      comments: [{ type: "comment", id: "t1-c1", text: "Hi" }],
    },
    {
      type: "topic",
      id: "t2",
      title: "Second",
      votes: [{ type: "vote", id: "t2-v1", value: 2 }],
      comments: [],
    },
  ]);
});

test("it doesn't throw on orphans by default", () => {
  const [_, ...rest] = input;
  const result = join(rest, "topic", fieldMap);

  assert.deepEqual(result, [
    {
      type: "topic",
      id: "t2",
      title: "Second",
      votes: [{ type: "vote", id: "t2-v1", value: 2 }],
      comments: [],
    },
  ]);
});

test("it does throw on orphans when requested", () => {
  const [_, ...rest] = input;

  const join = createJoinOn({
    idKey: "id",
    typeKey: "type",
    predicate: (childId: string, parentId: string) =>
      childId.startsWith(parentId),
    throwOnOrphanedData: true,
  });

  assert.throws(() => join(rest, "topic", fieldMap), OrphanedDataError);
});
