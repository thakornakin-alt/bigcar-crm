"use client";

import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { DocumentCenter } from "@/components/documents/DocumentCenter";
import { DocumentGeneratorV2 } from "@/components/documents/DocumentGeneratorV2";

export default function DocumentsPage() {
  const [view, setView] = useState<"download" | "generate">("download");

  return (
    <div className="space-y-5 pt-8 sm:pt-10 lg:px-8 xl:px-12">
      <div className="mx-auto w-full max-w-3xl px-1 pt-2 lg:max-w-6xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">BIG CAR CRM</p>
        <h1 className="mt-2 text-3xl font-black text-white">Document center</h1>
      </div>

      <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-3 rounded-2xl border border-line bg-[#0b0d11] p-3 lg:max-w-6xl">
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

      <div className={view === "download" ? "block lg:max-w-6xl lg:mx-auto" : "hidden"}>
        <DocumentCenter />
      </div>
      <div className={view === "generate" ? "block lg:max-w-6xl lg:mx-auto" : "hidden"}>
        <DocumentGeneratorV2 />
      </div>
    </div>
  );
}
