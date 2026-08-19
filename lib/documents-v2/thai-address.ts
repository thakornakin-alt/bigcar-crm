export type ThaiAddressMode = "canonical" | "manual";

export type ThaiAddressValue = {
  province: string;
  district: string;
  subdistrict: string;
  mode: ThaiAddressMode;
};

export type ThaiSubdistrict = { id: string; name: string; postalCode?: string };
export type ThaiDistrict = { id: string; name: string; subdistricts: ThaiSubdistrict[] };
export type ThaiProvince = { id: string; name: string; districts: ThaiDistrict[] };
export type ThaiAddressDataset = {
  source: string;
  sourceUrl: string;
  version: string;
  provinces: ThaiProvince[];
};

let datasetPromise: Promise<ThaiAddressDataset> | null = null;

export function loadThaiAddressDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch("/data/thai-addresses-b8b3fb9.json", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดรายการที่อยู่ไม่สำเร็จ");
        return response.json() as Promise<ThaiAddressDataset>;
      })
      .catch((error) => {
        datasetPromise = null;
        throw error;
      });
  }
  return datasetPromise;
}

export function findProvince(dataset: ThaiAddressDataset, provinceName: string) {
  return dataset.provinces.find((province) => province.name === String(provinceName || "").trim());
}

export function findDistrict(dataset: ThaiAddressDataset, provinceName: string, districtName: string) {
  return findProvince(dataset, provinceName)?.districts.find((district) => district.name === String(districtName || "").trim());
}

export function findSubdistrict(dataset: ThaiAddressDataset, provinceName: string, districtName: string, subdistrictName: string) {
  return findDistrict(dataset, provinceName, districtName)?.subdistricts.find((subdistrict) => subdistrict.name === String(subdistrictName || "").trim());
}

export function validateThaiAddressSelection(dataset: ThaiAddressDataset, value: ThaiAddressValue) {
  if (value.mode === "manual") return { valid: true, manual: true, issue: "" };
  const province = findProvince(dataset, value.province);
  if (!province) return { valid: false, manual: false, issue: "province" };
  const district = province.districts.find((item) => item.name === value.district);
  if (!district) return { valid: false, manual: false, issue: "district" };
  const subdistrict = district.subdistricts.find((item) => item.name === value.subdistrict);
  if (!subdistrict) return { valid: false, manual: false, issue: "subdistrict" };
  return { valid: true, manual: false, issue: "" };
}

export function selectThaiProvince(value: ThaiAddressValue, province: string): ThaiAddressValue {
  if (province === value.province) return value;
  return { ...value, province, district: "", subdistrict: "" };
}

export function selectThaiDistrict(value: ThaiAddressValue, district: string): ThaiAddressValue {
  if (district === value.district) return value;
  return { ...value, district, subdistrict: "" };
}

export function filterThaiAddressOptions<T extends { name: string }>(options: T[], query: string, limit = 40) {
  const needle = String(query || "").trim().toLocaleLowerCase("th-TH");
  if (!needle) return options.slice(0, limit);
  return options.filter((option) => option.name.toLocaleLowerCase("th-TH").includes(needle)).slice(0, limit);
}

export function thaiAddressLabels(province: string) {
  const bangkok = province === "กรุงเทพมหานคร";
  return {
    district: bangkok ? "เขต" : "อำเภอ",
    subdistrict: bangkok ? "แขวง" : "ตำบล"
  };
}
