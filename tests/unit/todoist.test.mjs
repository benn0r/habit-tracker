import assert from "node:assert/strict";
import test from "node:test";
import { paged, todoist, TodoistError } from "../../lib/todoist.ts";

test("follows encoded Todoist cursors and combines pages", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (input, options) => {
    calls.push({ url: String(input), authorization: options.headers.Authorization });
    const body =
      calls.length === 1 ? { results: [{ id: "one" }], next_cursor: "next page" } : { results: [{ id: "two" }] };
    return new Response(JSON.stringify(body), { status: 200 });
  });

  assert.deepEqual(await paged("/tasks?limit=1", "secret"), [{ id: "one" }, { id: "two" }]);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /limit=1&cursor=next%20page$/);
  assert.equal(calls[0].authorization, "Bearer secret");
});

test("supports custom collection keys and rejects malformed pages", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify({ items: [{ id: "done" }] }), { status: 200 }),
  );
  assert.deepEqual(await paged("/completed", "secret", "items"), [{ id: "done" }]);
  await assert.rejects(() => paged("/tasks", "secret"), /did not contain "results"/);
});

test("preserves Todoist response status and message", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("expired token", { status: 401 }));
  await assert.rejects(
    () => todoist("/user", "secret"),
    (error) => error instanceof TodoistError && error.status === 401 && /expired token/.test(error.message),
  );
});
