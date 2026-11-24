import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export function cacheQueryDocuments(db: QueryCtx["db"]) {
  const documents = new Map<string, Promise<unknown>>();

  return function get<Table extends TableNames>(id: Id<Table>): Promise<Doc<Table> | null> {
    let document = documents.get(id);
    if (!document) {
      document = db.get(id);
      documents.set(id, document);
    }
    // Convex IDs identify their table, so each entry retains its original document type.
    return document as Promise<Doc<Table> | null>;
  };
}
