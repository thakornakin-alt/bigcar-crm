export const siteConfig = {
  brandName: "BIG CAR RDD",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://bigcar-rdd.vercel.app",
  phone: "091-778-5117",
  contactName: "บิ๊ก",
  lineId: "@bigcars",
  lineUrl: "https://lin.ee/8m7vycn",
  siteSheetId: process.env.BIGCAR_SITE_SHEET_ID || "",
  siteContactEmail: process.env.SITE_CONTACT_EMAIL || "",
  siteAdminEmail: process.env.SITE_ADMIN_EMAIL || "",
  siteAdminPassword: process.env.SITE_ADMIN_PASSWORD || "bigcar-rdd"
};

export const siteNavItems = [
  { href: "/showroom", label: "หน้าแรก" },
  { href: "/cars", label: "รถทั้งหมด" },
  { href: "/lease-return-cars", label: "รถหมดสัญญาเช่า" },
  { href: "/why-us", label: "ทำไมต้องเรา" },
  { href: "/locations", label: "สถานที่จอด" },
  { href: "/articles", label: "บทความ" },
  { href: "/contact", label: "ติดต่อ" }
];
