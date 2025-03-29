# flat-join

A really lightweight and typesafe package to group and merge related items
from a flat array.

## Install

```
npm install -S flat-join
```

## Why is this useful?

When using no frills databases (e.g. DynamoDB), simple data formats, etc, it's
common not to be able to do SQL-like joins.

A common work around is to instead store related documents beside each other in a
flat list, where the child documents have a key which is prefixed by the parent
document's key.

For example, we might define a blog post and comments like so:

```ts
interface BlogPost {
  id: string;
  title: string;
  description: string;
}

interface BlogPostComment {
  id: string;
  comment: string;
  author: string;
}
```

Rather than storing these entities in separate collections, we could store them
in a flat list. We'd also need to add a _discriminator_ field, that is, a field
that allows us to tell the different types apart. We'll call it `type`.

```ts
const postsAndComments: (BlogPost | BlogPostComment)[] = [
  { type: 'post', id: 'post-1', title: 'Test', description: 'Hello, world!' },
  { type: 'comment', id: 'post-1:comment-1', comment: 'Good job!', author: 'Dave' },
  { type: 'comment', id: 'post-1:comment-2', comment: 'Hmmm... :(', author: 'Bob' },
  { type: 'post', id: 'post-2', title: 'Test 2', description: 'Another test!' },
];
```

As you can see, the comments related to the post with ID `"post-1"` have an ID
prefixed with that value. Using a prefix is the most obvious way, since the child
documents must follow their parent document for the algorithm to be efficient, 
and using a prefix ensures they're sorted in the correct order for this.

Ideally, we'd want to hide this storage implementation detail from the rest of our
app, and pass on a type that looks more like this:

```ts
interface BlogPostWithComments {
  id: string;
  title: string;
  description: string;
  comments: BlogPostComment[];
}
```

Enter `flat-join`!

## Usage

Using the types and data from above:

```ts
import { flatJoin } from 'flat-join';

const postsWithComments = flatJoin(
  // the data to join
  postsAndComments,
  // the value of `type` for the "primary" entity,
  // i.e., the blog post itself
  "post" as const,
  // a mapping of the other entity types to the
  // name of the field they are to be collected into
  { "comment": "comments" } as const,
  // additional options
  {
    // the name of the key that will be used as the ID
    idKey: "id",
    // the name of the key that will be used as the discriminator
    typeKey: "type",
    // a function specifying how to match children to parents
    predicate: (childId: string, parentId: string) =>
      childId.startsWith(parentId),
  },
);
```

The _really_ cool part is that `postsWithComments` will auto-magically
have the correct type!

**IMPORTANT:** for the inference to work you need to add `as const`
to the 2nd and 3rd arguments.

Since in a given project, you'll probably use the same names for the
ID and discriminator keys, and the same `predicate` function, for
convenience you can encapsulate the options:

```ts
const join = createJoinOn({
  idKey: "id",
  typeKey: "type",
  predicate: (child: string, parent: string) => child.startsWith(parent),
});

const postsWithComments = join(
  postsAndComments,
  "post" as const,
  { "comment": "comments" } as const,
);
```

There is an additional option not mentioned yet, `throwOnOrphanedData`,
which is `false` by default. If `join` encounters data that it doesn't expect,
it will normally just silently ignore it. If you set `throwOnOrphanedData` to
`true`, an error will be thrown instead.

```ts
const join = createJoinOn({
  idKey: "id",
  typeKey: "type",
  predicate: (child: string, parent: string) => child.startsWith(parent),
  throwOnOrphanedData: true,
});

// throws OrphanedDataError
const postsWithComments = join(
  { type: 'comment', id: 'post-1:comment-1', comment: 'Good job!', author: 'Dave' },
  { type: 'post', id: 'post-1', title: 'Test', description: 'Hello, world!' },
  { type: 'cat', id: 'cat-1', name: 'Socks' },
  "post" as const,
  { "comment": "comments" } as const,
);
```

Note that even though `post-1` exists, since the join goes through the elements
in order, it won't have encountered it yet when it encounters the comment.
Every child of a given document must be directly after it with no 'primary'
documents or unrelated children in between. The first element must also be
a primary document.

If you know your data is not ordered like this, simply sort it before joining.
