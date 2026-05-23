import { Activity, Lock, Shield, UserCog, UsersRound } from "lucide-react";
import { CrmShell, MetricCard } from "@/app/components/crm-shell";
import { SectionCard } from "@/app/components/ui";
import { demoCurrentUser, roleLabels } from "@/lib/crm-core";

const users = [
  demoCurrentUser,
  {
    ...demoCurrentUser,
    id: "user-fai",
    firstName: "กันตา",
    lastName: "ประพฤทธิ์ชัย",
    nickname: "ฝ้าย",
    email: "fai@bigcar-rdd.local",
    phone: "085-554-5997",
    role: "sales" as const
  },
  {
    ...demoCurrentUser,
    id: "user-viewer",
    firstName: "ทีม",
    lastName: "ดูข้อมูล",
    nickname: "Viewer",
    email: "viewer@bigcar-rdd.local",
    phone: "-",
    role: "viewer" as const
  }
];

export default function CrmAdminPage() {
  return (
    <CrmShell user={demoCurrentUser} title="Admin CRM" subtitle="แผงจัดการสิทธิ์แบบแยก module สำหรับ Phase 1 ยังไม่กระทบ Admin/CRM เดิม">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="ผู้ใช้" value={users.length.toLocaleString("th-TH")} hint="เตรียมย้ายเข้า Users Sheet" icon={<UsersRound size={18} className="text-brand" />} />
          <MetricCard label="Role" value="4" hint="Super Admin / Admin / Sales / Viewer" icon={<Shield size={18} className="text-brand" />} />
          <MetricCard label="Locked" value="0" hint="รองรับ lock/unlock account" icon={<Lock size={18} className="text-brand" />} />
          <MetricCard label="Activity" value="พร้อมต่อ" hint="login/export/edit/delete" icon={<Activity size={18} className="text-brand" />} />
        </div>

        <SectionCard title="จัดการ User" icon={<UserCog size={18} />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-soft">
                  <th className="px-3 py-2">ชื่อ</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">เบอร์</th>
                  <th className="px-3 py-2">สาขา</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-line/70">
                    <td className="px-3 py-3 font-bold text-white">{user.nickname} · {user.firstName}</td>
                    <td className="px-3 py-3 text-soft">{user.email}</td>
                    <td className="px-3 py-3 text-soft">{user.phone}</td>
                    <td className="px-3 py-3 text-soft">{user.branch}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-1 text-xs font-bold text-brand">{roleLabels[user.role]}</span>
                    </td>
                    <td className="px-3 py-3 text-soft">{user.locked ? "Locked" : "Active"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="ขอบเขต Phase 1">
          <div className="grid gap-2 text-sm text-soft sm:grid-cols-2">
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">ยังไม่เปิด middleware บังคับ login หน้าเดิม</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">ยังไม่เปลี่ยน Customers Sheet เดิม</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">เตรียม Users / Sessions / ActivityLogs เป็น Sheet ใหม่</p>
            <p className="rounded-lg border border-line bg-[#0b0d11] px-3 py-3">พร้อมต่อ ProtectedRoute ทีละหน้าใน Phase 2</p>
          </div>
        </SectionCard>
      </div>
    </CrmShell>
  );
}
