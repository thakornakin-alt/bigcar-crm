import type { Article, PublicCar, SiteLocation } from "./types";

export const siteLocations: SiteLocation[] = [
  {
    key: "bangna",
    name: "โกดังบางนา",
    shortName: "บางนา",
    mapUrl: "https://maps.app.goo.gl/MVKjNVT7Arv9uL2S8?g_st=ic",
    description: "จุดจอดรถหลักสำหรับนัดดูรถหมดสัญญาเช่า โซนบางนา"
  },
  {
    key: "thepharak",
    name: "โกดังเทพารักษ์",
    shortName: "เทพารักษ์",
    mapUrl: "https://maps.app.goo.gl/ubWvr2vcLZFCTsCQ8?g_st=ic",
    description: "จุดจอดรถสำหรับนัดดูรถ โซนเทพารักษ์ เดินทางสะดวก"
  }
];

export const mockCars: PublicCar[] = [
  {
    id: "car-001",
    brand: "Toyota",
    model: "Commuter 2.8 MT",
    year: 2020,
    price: 912000,
    mileage: 11354,
    plate: "1นช 4313",
    vin: "MMKBBHCPX06509126",
    location: "bangna",
    coverImage: "https://images.unsplash.com/photo-1549927681-0b673b8243ab?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1549927681-0b673b8243ab?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80"
    ],
    highlights: ["ไมล์แท้", "เช็คประวัติได้", "เข้าศูนย์ตามระยะ", "เหมาะใช้งานบริษัท"],
    description: "รถหมดสัญญาเช่า ตรวจสอบประวัติได้ เห็นสภาพจริงก่อนตัดสินใจ กรุณาโทรนัดก่อนเข้าชมรถ",
    status: "available",
    slug: "toyota-commuter-2-8-mt-2020",
    seoTitle: "Toyota Commuter 2.8 MT 2020 รถหมดสัญญาเช่า",
    seoDescription: "Toyota Commuter 2.8 MT ปี 2020 ไมล์แท้ เช็คประวัติได้ นัดดูรถได้ที่โกดังบางนา",
    createdAt: "2026-05-21",
    updatedAt: "2026-05-21"
  },
  {
    id: "car-002",
    brand: "Toyota",
    model: "Hilux Revo Smartcab 2.4 MID AT",
    year: 2020,
    price: 324000,
    mileage: 145933,
    plate: "3ฒศ 4326",
    vin: "MR0JC8CC500872904",
    location: "thepharak",
    coverImage: "https://images.unsplash.com/photo-1594502184342-2e12f877aa73?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1594502184342-2e12f877aa73?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80"
    ],
    highlights: ["ราคาดี", "ไมล์แท้ 100%", "มีประวัติ", "พร้อมใช้งาน"],
    description: "กระบะหมดสัญญาเช่า ราคาเข้าถึงง่าย เหมาะสำหรับงานส่วนตัวและธุรกิจ ตรวจสภาพก่อนซื้อได้",
    status: "available",
    slug: "toyota-hilux-revo-smartcab-2-4-mid-at-2020",
    seoTitle: "Toyota Hilux Revo Smartcab 2.4 MID AT 2020 รถหมดสัญญาเช่า",
    seoDescription: "Toyota Hilux Revo Smartcab 2020 ไมล์แท้ ราคาดี เช็คประวัติได้ นัดดูรถที่โกดังเทพารักษ์",
    createdAt: "2026-05-21",
    updatedAt: "2026-05-21"
  },
  {
    id: "car-003",
    brand: "Toyota",
    model: "Vios 1.5 MID AT",
    year: 2020,
    price: 279000,
    mileage: 107029,
    plate: "1ขฏ 2060",
    vin: "MR2B29F3X01210651",
    location: "thepharak",
    coverImage: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80"
    ],
    highlights: ["ประหยัด", "ดูแลง่าย", "เช็คศูนย์", "ราคาเบา"],
    description: "รถเก๋งหมดสัญญาเช่า เหมาะใช้ในเมือง ขับง่าย ดูแลไม่ยาก ตรวจสอบประวัติได้",
    status: "available",
    slug: "toyota-vios-1-5-mid-at-2020",
    seoTitle: "Toyota Vios 1.5 MID AT 2020 รถหมดสัญญาเช่า",
    seoDescription: "Toyota Vios ปี 2020 รถหมดสัญญาเช่า ไมล์แท้ เช็คประวัติได้ ราคาดี",
    createdAt: "2026-05-21",
    updatedAt: "2026-05-21"
  }
];

export const mockArticles: Article[] = [
  {
    slug: "are-lease-return-cars-good",
    title: "รถหมดสัญญาเช่าดีไหม",
    description: "ข้อดีของรถหมดสัญญาเช่า และสิ่งที่ควรตรวจสอบก่อนตัดสินใจซื้อ",
    coverImage: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80",
    publishedAt: "2026-05-21",
    readingMinutes: 4,
    sections: [
      {
        heading: "จุดเด่นของรถหมดสัญญาเช่า",
        body: "รถหมดสัญญาเช่ามักมีประวัติการใช้งานชัดเจน ตรวจสอบเลขไมล์และการเข้าศูนย์ได้ง่ายกว่ารถมือสองทั่วไป"
      },
      {
        heading: "ควรเช็คอะไรบ้าง",
        body: "ควรตรวจประวัติศูนย์ สภาพตัวถัง เลขไมล์ เอกสาร และควรเห็นรถจริงก่อนตัดสินใจทุกครั้ง"
      }
    ]
  },
  {
    slug: "how-to-check-real-mileage",
    title: "รถมือสองไมล์แท้ดูยังไง",
    description: "วิธีดูเลขไมล์รถมือสองเบื้องต้น พร้อมแนวทางเช็คประวัติรถ",
    coverImage: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
    publishedAt: "2026-05-21",
    readingMinutes: 3,
    sections: [
      {
        heading: "เริ่มจากประวัติ",
        body: "เลขไมล์ที่น่าเชื่อถือควรสัมพันธ์กับประวัติเข้าศูนย์ สภาพภายใน และการใช้งานจริงของรถ"
      }
    ]
  }
];
