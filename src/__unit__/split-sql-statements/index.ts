import test from "ava"

import {splitSqlStatements} from "../../split-sql-statements"

test("splits on bare semicolons", (t) => {
  t.deepEqual(splitSqlStatements("select 1; select 2;"), [
    "select 1",
    "select 2",
  ])
})

test("ignores semicolons inside single-quoted strings", (t) => {
  t.deepEqual(splitSqlStatements("select 'a;b'; select 2;"), [
    "select 'a;b'",
    "select 2",
  ])
})

test("ignores semicolons inside escaped single quotes", (t) => {
  t.deepEqual(splitSqlStatements("select 'it''s; fine'; select 2;"), [
    "select 'it''s; fine'",
    "select 2",
  ])
})

test("ignores semicolons inside double-quoted identifiers", (t) => {
  t.deepEqual(splitSqlStatements('select "weird;col"; select 2;'), [
    'select "weird;col"',
    "select 2",
  ])
})

test("ignores semicolons inside dollar-quoted strings", (t) => {
  t.deepEqual(
    splitSqlStatements("do $$ begin perform 'x;y'; end $$; select 2;"),
    ["do $$ begin perform 'x;y'; end $$", "select 2"],
  )
})

test("ignores semicolons inside tagged dollar quotes", (t) => {
  t.deepEqual(splitSqlStatements("select $tag$ a;b $tag$; select 2;"), [
    "select $tag$ a;b $tag$",
    "select 2",
  ])
})

test("ignores semicolons inside line comments", (t) => {
  t.deepEqual(splitSqlStatements("-- note; keep\nselect 1;\nselect 2;"), [
    "-- note; keep\nselect 1",
    "select 2",
  ])
})

test("ignores semicolons inside block comments", (t) => {
  t.deepEqual(splitSqlStatements("/* a; b */ select 1; select 2;"), [
    "/* a; b */ select 1",
    "select 2",
  ])
})

test("keeps disable-transaction directive with first statement", (t) => {
  const sql = `-- postgres-migrations disable-transaction
alter table t add column if not exists x int;
create index concurrently if not exists t_x_idx on t (x);`

  t.deepEqual(splitSqlStatements(sql), [
    "-- postgres-migrations disable-transaction\nalter table t add column if not exists x int",
    "create index concurrently if not exists t_x_idx on t (x)",
  ])
})

test("returns a single statement when there is no terminator", (t) => {
  t.deepEqual(splitSqlStatements("select 1"), ["select 1"])
})

test("drops empty statements", (t) => {
  t.deepEqual(splitSqlStatements("select 1;;;\n\n;select 2;"), [
    "select 1",
    "select 2",
  ])
})
