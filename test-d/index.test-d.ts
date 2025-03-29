import { expectType, expectError, expectAssignable } from "tsd";
import { createJoinOn, JoinedType } from "../dist"; 

type Entry =
  | { type: "topic"; id: string; title: string }
  | { type: "vote"; id: string; value: number }
  | { type: "comment"; id: string; body: string };

type JoinedTopic = JoinedType<
  Entry,
  "type",
  "topic",
  {
    vote: "votes";
    comment: "comments";
  }
>;

declare const input: Entry[];

const join = createJoinOn({
  idKey: "id",
  typeKey: "type",
  predicate: (child:string, parent:string) => child.startsWith(parent),
});

const result = join(input, "topic" as const, {
  vote: "votes",
  comment: "comments",
} as const);


expectAssignable<JoinedTopic[]>(result);

// 'reaction' is not a valid type
expectError(
  join(input, "topic" as const, {
    vote: "votes",
    reaction: "reactions",
  } as const),
);

// missing the 'votes' field
expectError(
  join(input, "topic" as const, {
    comment: "comments",
  } as const),
);

expectType<number>(result[0].votes[0].value);

// incorrect access should throw
expectError(result[0].reactions);
expectError(result[0].votes[0].notARealField);
