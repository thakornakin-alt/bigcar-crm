import Link from "next/link";

export default function RealtimeBookingLegacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
      <section className="w-full rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(17,24,32,0.92),rgba(7,10,15,0.94))] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">Realtime Booking Legacy</p>
        <h1 className="mt-2 text-2xl font-black">หน้าสำรองของระบบแย่งจอง</h1>
        <p className="mt-3 text-sm leading-6 text-soft">
          ระบบหลักถูกย้ายไปหน้า Realtime Booking ใหม่แล้ว หน้านี้เก็บไว้เป็นเส้นทางสำรองสำหรับใช้งานภายในและตรวจสอบย้อนหลัง
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/realtime-booking"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-brand bg-brand px-4 text-sm font-black text-ink"
          >
            ไปหน้า Realtime Booking
          </Link>
          <Link
            href="/realtime-booking-v2"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white"
          >
            ไปหน้าแย่งจองใหม่
          </Link>
        </div>
      </section>
    </main>
  );
}
