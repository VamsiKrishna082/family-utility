import type { Metadata } from "next";
import { TaxPack } from "@/components/TaxPack";

export const metadata: Metadata = { title: "Tax pack" };

export default function TaxPage() {
  return <TaxPack />;
}
