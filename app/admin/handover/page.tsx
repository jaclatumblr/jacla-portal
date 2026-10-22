import { readFile } from "node:fs/promises";
import path from "node:path";
import { HandoverPageClient } from "./HandoverPageClient";

export default async function AdminHandoverPage() {
  const content = await readFile(path.join(process.cwd(), "docs/admin-handover.md"), "utf8");

  return <HandoverPageClient content={content} />;
}
