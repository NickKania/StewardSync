import { Id } from "../_generated/dataModel";

export type ChangeSource = "manual" | "simgrid" | "system";

export interface RecordChangeArgs {
  tableName: string;
  documentId: string;
  fieldName: string;
  fromValue?: unknown;
  toValue?: unknown;
  changedByUserId?: Id<"users">;
  source?: ChangeSource;
}

function serializeValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export async function recordChange(
  ctx: any,
  args: RecordChangeArgs,
): Promise<void> {
  const fromSerialized = serializeValue(args.fromValue);
  const toSerialized = serializeValue(args.toValue);

  if (fromSerialized === toSerialized) {
    return;
  }

  await ctx.db.insert("changeHistory", {
    tableName: args.tableName,
    documentId: args.documentId,
    fieldName: args.fieldName,
    fromValue: fromSerialized,
    toValue: toSerialized,
    changedByUserId: args.changedByUserId,
    source: args.source ?? "manual",
    changedAt: Date.now(),
  });
}

export interface FieldChange {
  fieldName: string;
  fromValue?: unknown;
  toValue?: unknown;
}

export async function recordChanges(
  ctx: any,
  args: {
    tableName: string;
    documentId: string;
    changes: FieldChange[];
    changedByUserId?: Id<"users">;
    source?: ChangeSource;
  },
): Promise<void> {
  for (const change of args.changes) {
    await recordChange(ctx, {
      tableName: args.tableName,
      documentId: args.documentId,
      fieldName: change.fieldName,
      fromValue: change.fromValue,
      toValue: change.toValue,
      changedByUserId: args.changedByUserId,
      source: args.source,
    });
  }
}

export function compareAndBuildChanges<T extends Record<string, unknown>>(
  original: T,
  updates: Partial<T>,
  fieldsToAudit: (keyof T)[],
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of fieldsToAudit) {
    if (field in updates) {
      const fromValue = original[field];
      const toValue = updates[field];

      if (serializeValue(fromValue) !== serializeValue(toValue)) {
        changes.push({
          fieldName: String(field),
          fromValue,
          toValue,
        });
      }
    }
  }

  return changes;
}
