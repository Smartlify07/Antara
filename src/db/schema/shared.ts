import { randomUUID } from "node:crypto"
import { text } from "drizzle-orm/pg-core"

export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID())
