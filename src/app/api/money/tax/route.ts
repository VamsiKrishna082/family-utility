import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { folderPath } from "@/lib/docFolders";
import { fyLabel, fyOf, fyRange, taxChecklist, taxTotals, type TaxTx } from "@/lib/taxPack";
import type { DocCategory, DocFolder, DocRecord, MoneyCategory, MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/money/tax?fy=2026 — the tax-season pack for a financial year:
 * income, tax-relevant spending and investments from Money, and a checklist
 * of the documents you'll want (matched from Documents by name, tags,
 * folder and category).
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const asked = Number(new URL(req.url).searchParams.get("fy"));
    const fy = asked >= 2000 && asked <= 2100 ? asked : fyOf(today);
    const { from, to } = fyRange(fy);

    const [txSnap, catSnap, docSnap, docCatSnap, folderSnap] = await Promise.all([
      db().collection("money_tx").where("date", ">=", from).where("date", "<=", to).get(),
      db().collection("money_categories").get(),
      db().collection("doc_records").where("archived", "==", false).get(),
      db().collection("doc_categories").get(),
      db().collection("doc_folders").get(),
    ]);
    const cats = new Map(catSnap.docs.map((d) => [d.id, d.data() as MoneyCategory]));
    const txs: TaxTx[] = txSnap.docs.map((d) => d.data() as MoneyTx).map((t) => ({
      type: t.type, amountPaise: t.amountPaise, date: t.date,
      categoryName: `${cats.get(t.categoryId)?.group ?? ""} ${cats.get(t.categoryId)?.name ?? ""}`.trim(),
      subcategory: t.subcategory, note: t.note,
    }));

    const docCats = new Map(docCatSnap.docs.map((d) => [d.id, (d.data() as DocCategory).name]));
    const folders = folderSnap.docs.map((d) => d.data() as DocFolder);
    const docs = docSnap.docs.map((d) => d.data() as DocRecord).map((r) => ({
      id: r.id,
      name: r.name,
      text: [docCats.get(r.categoryId), folderPath(folders, r.folderId), r.issuer, r.notes, ...(r.tags ?? []), ...(r.attachments ?? []).map((a) => a.name)].filter(Boolean).join(" "),
    }));

    return ok({ fy, label: fyLabel(fy), from, to, currentFy: fyOf(today), ...taxTotals(txs, fy), checklist: taxChecklist(docs) });
  } catch (e) {
    return fail(e);
  }
}
