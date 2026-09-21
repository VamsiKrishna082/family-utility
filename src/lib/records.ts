import type { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

/**
 * Six sections (money, worth, bills, dates, trips, wishlist) are all the same
 * shape underneath: a flat Firestore collection, list + create + delete, one
 * pooled space shared by both of you (no per-user ownership beyond an
 * `addedBy` audit field). This factory is that shape, once.
 *
 * Lists and Vehicles don't use this — they nest items/logs inside a parent
 * doc instead of a flat collection, which is a genuinely different shape.
 * Emergency doesn't either — it's a single document, not a collection.
 */
export function recordRoutes<T extends z.ZodTypeAny>(
  collection: string,
  schema: T,
  orderBy: { field: string; direction?: "asc" | "desc" } = { field: "createdAt", direction: "desc" },
) {
  async function GET() {
    try {
      await requireUser();
      const snap = await db().collection(collection).orderBy(orderBy.field, orderBy.direction ?? "desc").get();
      return ok({ items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    } catch (e) {
      return fail(e);
    }
  }

  async function POST(req: Request) {
    try {
      const user = await requireUser();
      const body = schema.parse(await req.json());
      const now = Date.now();
      const ref = await db()
        .collection(collection)
        .add({ ...body, addedBy: user.email, createdAt: now, updatedAt: now });
      return ok({ id: ref.id });
    } catch (e) {
      return fail(e);
    }
  }

  return { GET, POST };
}

/** PATCH (partial update) and DELETE for a single doc in a flat collection. */
export function recordItemRoutes(collection: string) {
  async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
      await requireUser();
      const { id } = await ctx.params;
      const body = (await req.json()) as Record<string, unknown>;
      await db()
        .collection(collection)
        .doc(id)
        .set({ ...body, updatedAt: Date.now() }, { merge: true });
      return ok({ id });
    } catch (e) {
      return fail(e);
    }
  }

  async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
      await requireUser();
      const { id } = await ctx.params;
      await db().collection(collection).doc(id).delete();
      return ok({ id });
    } catch (e) {
      return fail(e);
    }
  }

  return { PATCH, DELETE };
}
