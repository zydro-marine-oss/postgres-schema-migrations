import test from "ava"
import * as sinon from "sinon"
import {fileURLToPath} from "url"
import {dirname} from "path"

import {runMigration} from "../../run-migration"
import {loadSqlFromJs} from "../../load-sql-from-js"
import {promisify} from "util"
import {readFile as fsReadFile} from "fs"
import {Migration} from "../../types"

const testDir = dirname(fileURLToPath(import.meta.url))
const readFile = promisify(fsReadFile)

let normalSqlFile: string
let normalJsFile: string
let noTransactionSqlFile: string

test.before(async () => {
  await Promise.all([
    readFile(testDir + "/fixtures/normal.sql", "utf8").then((contents) => {
      normalSqlFile = contents
    }),

    readFile(testDir + "/fixtures/no-transaction.sql", "utf8").then(
      (contents) => {
        noTransactionSqlFile = contents
      },
    ),

    loadSqlFromJs(testDir + "/fixtures/normal.sql.js").then((contents) => {
      normalJsFile = contents
    }),
  ])
})

function buildMigration(sql: string): Migration {
  return {
    id: 1,
    name: "name",
    sql,
    hash: "hash",
    contents: "contents",
    fileName: "testfile.test",
  }
}
const migrationTableName = "migrations"

test("runs a simple migration", (t) => {
  const query = sinon.stub().resolves()
  const run = runMigration(migrationTableName, {query})

  const migration = buildMigration(normalSqlFile)

  return run(migration).then(() => {
    t.is(query.callCount, 4)
    t.is(
      query.firstCall.args[0],
      "START TRANSACTION",
      "should begin a transaction",
    )

    t.is(
      query.secondCall.args[0],
      migration.sql,
      "should execute the migration",
    )

    t.deepEqual(
      query.thirdCall.args[0].values,
      [migration.id, migration.name, migration.hash],
      "should record the running of the migration in the database",
    )

    t.is(query.lastCall.args[0], "COMMIT", "should complete the transaction")
  })
})

test("runs a simple js migration", (t) => {
  const query = sinon.stub().resolves()
  const run = runMigration(migrationTableName, {query})

  const migration = buildMigration(normalJsFile)

  return run(migration).then(() => {
    t.is(query.callCount, 4)
    t.is(
      query.firstCall.args[0],
      "START TRANSACTION",
      "should begin a transaction",
    )

    t.is(
      query.secondCall.args[0],
      migration.sql,
      "should execute the migration",
    )

    t.deepEqual(
      query.thirdCall.args[0].values,
      [migration.id, migration.name, migration.hash],
      "should record the running of the migration in the database",
    )

    t.is(query.lastCall.args[0], "COMMIT", "should complete the transaction")
  })
})

test("rolls back when there is an error inside a transactiony migration", async (t) => {
  const query = sinon.stub().rejects(new Error("There was a problem"))
  const run = runMigration(migrationTableName, {query})

  const migration = buildMigration(normalSqlFile)
  t.plan(2)

  await run(migration).catch((e) => {
    t.is(query.lastCall.args[0], "ROLLBACK", "should perform a rollback")
    t.true(
      e.message.indexOf("There was a problem") >= 0,
      "should throw an error",
    )
  })
})

test("does not run the migration in a transaction when instructed", async (t) => {
  const query = sinon.stub().resolves()
  const run = runMigration(migrationTableName, {query})

  const migration = buildMigration(noTransactionSqlFile)

  await run(migration).then(() => {
    t.is(query.callCount, 2)

    t.is(
      query.firstCall.args[0],
      migration.sql.trim().replace(/;$/, ""),
      "should run the migration statement without an enclosing transaction",
    )

    t.deepEqual(
      query.secondCall.args[0].values,
      [migration.id, migration.name, migration.hash],
      "should record the running of the migration in the database",
    )
  })
})

test("splits disable-transaction migrations into separate queries", async (t) => {
  const query = sinon.stub().resolves()
  const run = runMigration(migrationTableName, {query})

  const migration = buildMigration(`-- postgres-migrations disable-transaction
alter table t add column if not exists x int;
create index concurrently if not exists t_x_idx on t (x);
`)

  await run(migration)

  t.is(query.callCount, 3)
  t.is(
    query.firstCall.args[0],
    "-- postgres-migrations disable-transaction\nalter table t add column if not exists x int",
  )
  t.is(
    query.secondCall.args[0],
    "create index concurrently if not exists t_x_idx on t (x)",
  )
  t.deepEqual(query.thirdCall.args[0].values, [
    migration.id,
    migration.name,
    migration.hash,
  ])
  sinon.assert.neverCalledWith(query, "START TRANSACTION")
  sinon.assert.neverCalledWith(query, "COMMIT")
})

test("does not roll back when there is an error inside a transactiony migration", async (t) => {
  const query = sinon.stub().rejects(new Error("There was a problem"))
  const run = runMigration(migrationTableName, {query})

  const migration = buildMigration(noTransactionSqlFile)

  await run(migration).catch((e) => {
    sinon.assert.neverCalledWith(query, "ROLLBACK")
    t.true(
      e.message.indexOf("There was a problem") >= 0,
      "should throw an error",
    )
  })
})
