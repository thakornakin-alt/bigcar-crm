import Link from "next/link";
import { Calculator, Car, FileImage, FileText, Plus, UsersRound } from "lucide-react";
import { CrmShell, MetricCard } from "@/app/components/crm-shell";
import { SectionCard, TopMenuButton } from "@/app/components/ui";
import { demoCurrentUser } from "@/lib/crm-core";

const quickActions = [
  { href: "/", label: "ลูกค้าเดิม", icon: <UsersRound size={18} /> },
  { href: "/stock-export", label: "สร้างรูปสต็อก", icon: <FileImage size={18} /> },
  { href: "/calculator", label: "ค่างวด", icon: <Calculator size={18} /> },
  { href: "/booking-reports", label: "รายงานจอง", icon: <FileText size={18} /> }
];

export default function CrmPage() {
  return (
    <CrmShell
      user={demoCurrentUser}
      title="CRM สำหรับเซลล์"
      subtitle="หน้าใหม่แบบ Multi-user shell ยังไม่บังคับกับระบบเดิม เพื่อให้ทดลองได้โดยไม่กระทบงานจริง"
      actions={<Link href="/auth" className="rounded-lg border border-line bg-panel px-4 py-3 text-sm font-bold text-white">สลับผู้ใช้</Link>}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="ลูกค้าของฉัน" value="0" hint="จะ filter owner ที่ backend" />
          <MetricCard label="รถพร้อมขาย" value="-" hint="อ่านจาก StockInventory เดิม" icon={<Car size={18} className="text-brand" />} />
          <MetricCard label="Export วันนี้" value="-" hint="เตรียมต่อ activity log" icon={<FileImage size={18} className="text-brand" />} />
          <MetricCard label="สิทธิ์" value="Super Admin" hint="รองรับ role-based access" />
        </div>

        <SectionCard title="งานที่ใช้บ่อย" icon={<Plus size={18} />}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <TopMenuButton key={action.href} href={action.href} icon={action.icon}>
                {action.label}
              </TopMenuButton>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Phase ต่อไป">
          <div className="grid gap-2 text-sm text-soft sm:grid-cols-2">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">เชื่อม Users Sheet แยก: Users / Sessions / ActivityLogs</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">ProtectedRoute แบบไม่แตะหน้าเดิม แล้วค่อยเปิดทีละ route</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">Owner validation สำหรับลูกค้าใหม่ ผ่าน API เท่านั้น</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">Upload profile image ผ่าน storage abstraction</p>
          </div>
        </SectionCard>
      </div>
    </CrmShell>
  );
}
