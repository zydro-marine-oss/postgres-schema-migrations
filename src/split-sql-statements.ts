// Split a SQL script into individual statements on bare semicolons.
// Respects single-quoted strings, double-quoted identifiers, dollar-quoted
// strings, line comments, and block comments so separators inside those
// contexts are not treated as statement boundaries.
export const splitSqlStatements = (sql: string): string[] => {
  const statements: string[] = []
  let current = ""
  let i = 0
  let state:
    | "normal"
    | "single"
    | "double"
    | "line_comment"
    | "block_comment"
    | "dollar" = "normal"
  let dollarTag = ""

  const pushCurrent = () => {
    const trimmed = current.trim()
    if (trimmed.length > 0) {
      statements.push(trimmed)
    }
    current = ""
  }

  while (i < sql.length) {
    const c = sql[i]
    const next = sql[i + 1]

    if (state === "line_comment") {
      current += c
      if (c === "\n") {
        state = "normal"
      }
      i += 1
      continue
    }

    if (state === "block_comment") {
      current += c
      if (c === "*" && next === "/") {
        current += next
        i += 2
        state = "normal"
        continue
      }
      i += 1
      continue
    }

    if (state === "single") {
      current += c
      if (c === "'" && next === "'") {
        current += next
        i += 2
        continue
      }
      if (c === "'") {
        state = "normal"
      }
      i += 1
      continue
    }

    if (state === "double") {
      current += c
      if (c === '"' && next === '"') {
        current += next
        i += 2
        continue
      }
      if (c === '"') {
        state = "normal"
      }
      i += 1
      continue
    }

    if (state === "dollar") {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag
        i += dollarTag.length
        state = "normal"
        continue
      }
      current += c
      i += 1
      continue
    }

    // state === "normal"
    if (c === "-" && next === "-") {
      current += c
      current += next
      i += 2
      state = "line_comment"
      continue
    }

    if (c === "/" && next === "*") {
      current += c
      current += next
      i += 2
      state = "block_comment"
      continue
    }

    if (c === "'") {
      current += c
      i += 1
      state = "single"
      continue
    }

    if (c === '"') {
      current += c
      i += 1
      state = "double"
      continue
    }

    if (c === "$") {
      const tagMatch = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)
      if (tagMatch) {
        dollarTag = tagMatch[0]
        current += dollarTag
        i += dollarTag.length
        state = "dollar"
        continue
      }
    }

    if (c === ";") {
      pushCurrent()
      i += 1
      continue
    }

    current += c
    i += 1
  }

  pushCurrent()
  return statements
}
