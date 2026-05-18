import { NextResponse } from "next/server";
import { uploadDriveFiles } from "@/lib/apps-script";
import type { DriveUploadFile, DriveUploadInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function cleanFile(file: Partial<DriveUploadFile>): DriveUploadFile {
  return {
    clientId: String(file.clientId || "").trim(),
    category: String(file.category || "").trim(),
    label: String(file.label || "").trim(),
    name: String(file.name || "file").trim(),
    type: String(file.type || "application/octet-stream").trim(),
    size: Number(file.size || 0),
    base64: String(file.base64 || "")
  };
}

function clean(body: Partial<DriveUploadInput>): DriveUploadInput {
  return {
    reportType: body.reportType === "booking" ? "booking" : "sales",
    customerName: String(body.customerName || "").trim(),
    plate: String(body.plate || "").trim(),
    saleName: String(body.saleName || "").trim(),
    files: Array.isArray(body.files) ? body.files.map(cleanFile).filter((file) => file.base64 && file.name) : []
  };
}

export async function POST(request: Request) {
  try {
    const payload = clean(await request.json());
    if (!payload.plate || !payload.customerName) {
      return NextResponse.json({ error: "Plate and customer name are required" }, { status: 400 });
    }
    if (!payload.files.length) {
      return NextResponse.json({ error: "No files to upload" }, { status: 400 });
    }

    const result = await uploadDriveFiles(payload);
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload files" },
      { status: 500 }
    );
  }
}
