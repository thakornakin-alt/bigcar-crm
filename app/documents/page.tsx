"use client";

import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { CrmShell } from "@/app/components/crm-shell";
import { DocumentCenter } from "@/components/documents/DocumentCenter";
import { DocumentGeneratorV2 } from "@/components/documents/DocumentGeneratorV2";
import { demoCurrentUser } from "@/lib/crm-core";

export default function DocumentsPage() {
  const [view, setView] = useState<"download" | "generate">("download");

  return (
    <CrmShell user={demoCurrentUser} title="Document center" subtitle="เอกสาร">
      <div className="space-y-5">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-3 rounded-2xl border border-line bg-[#0b0d11] p-3">
          <button
            type="button"
            onClick={() => setView("download")}
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${
              view === "download" ? "bg-brand text-ink" : "border border-line text-white"
            }`}
          >
            <Download size={18} />
            ดาวน์โหลดเอกสาร
          </button>
          <button
            type="button"
            onClick={() => setView("generate")}
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${
              view === "generate" ? "bg-brand text-ink" : "border border-line text-white"
            }`}
          >
            <FileText size={18} />
            สร้างเอกสาร
          </button>
        </div>

        <div className={view === "download" ? "block" : "hidden"}>
          <DocumentCenter />
        </div>
        <div className={view === "generate" ? "block" : "hidden"}>
          <DocumentGeneratorV2 />
        </div>
      </div>
    </CrmShell>
  );
}
