import { DocumentCenter } from "@/components/documents/DocumentCenter";
import { DocumentGeneratorV2 } from "@/app/documents-v2/page";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <DocumentCenter />
      <section id="document-generator-v2">
        <DocumentGeneratorV2 />
      </section>
    </div>
  );
}
