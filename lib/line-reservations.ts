import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const STORE_FILE = "line-reservations.json";
export type LineReservationAction = "reserve" | "unreserve";
export type LineReservationRecord = { plate:string; plateNormalized:string; active:boolean; updatedAt:string; sourceGroupId:string; sourceText:string };
type LineReservationStore = { byPlate: Record<string,LineReservationRecord> };

function normalizePlateForMatch(value:string){return String(value||"").normalize("NFKC").toUpperCase().replace(/\s*(?:กทม\.?|กรุงเทพ(?:มหานคร)?)\s*$/i,"").replace(/[.\-_/\\\s]+/g,"").trim()}
function cleanPlateValue(value:string){return String(value||"").normalize("NFKC").replace(/^(?:ทะเบียน\s*(?:รถ)?|plate|license\s*plate)\s*[:：=\-]?\s*/i,"").replace(/\s*(?:กทม\.?|กรุงเทพ(?:มหานคร)?)\s*$/i,"").trim()}

export function parseReserveAction(text:string):{action:LineReservationAction;plate:string}|null{
 const cleaned=String(text||"").normalize("NFKC").trim();if(!cleaned)return null;
 for(const pattern of[/(?:^|\s)(?:ติดจอง|จองทะเบียน|จอง|#?reserve)\s*(?:ทะเบียน\s*(?:รถ)?|plate|license\s*plate)?\s*[:：=\-]?\s*(.+)$/i]){const m=cleaned.match(pattern);if(m?.[1]){const plate=cleanPlateValue(m[1]);if(plate)return{action:"reserve",plate}}}
 for(const pattern of[/(?:^|\s)(?:ยกเลิกจองทะเบียน|ปล่อยจองทะเบียน|ยกเลิก|ปล่อยจอง|#?unreserve)\s*(?:ทะเบียน\s*(?:รถ)?|plate|license\s*plate)?\s*[:：=\-]?\s*(.+)$/i]){const m=cleaned.match(pattern);if(m?.[1]){const plate=cleanPlateValue(m[1]);if(plate)return{action:"unreserve",plate}}}
 return null;
}

// Booking messages used by sales are not guaranteed to contain the same auxiliary fields.
// A labelled plate field itself is sufficient reservation intent inside the LINE booking group.
function parseBookingFormPlates(text:string){
 return String(text||"").normalize("NFKC").split(/\r?\n/).map(line=>line.trim()).map(line=>line.match(/^(?:ทะเบียน\s*รถ|ทะเบียนรถ|ทะเบียน)\s*[:：=\-]\s*(.+)$/i)?.[1]||"").map(cleanPlateValue).filter(Boolean).map(plate=>({action:"reserve" as const,plate}));
}

export function parseLineReservationCommands(text:string):Array<{action:LineReservationAction;plate:string}>{
 const sourceText=String(text||"");
 const explicitCommands=sourceText.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(parseReserveAction).filter((item):item is{action:LineReservationAction;plate:string}=>Boolean(item));
 const combined=[...explicitCommands,...parseBookingFormPlates(sourceText)],seen=new Set<string>();
 return combined.filter(item=>{const normalized=normalizePlateForMatch(item.plate),key=`${item.action}:${normalized}`;if(!normalized||seen.has(key))return false;seen.add(key);return true});
}
async function readStore(){return readJsonStore<LineReservationStore>(STORE_FILE,{byPlate:{}})}
async function writeStore(store:LineReservationStore){await writeJsonStore(STORE_FILE,store)}
export async function listActiveReservedPlateKeys(){const store=await readStore();return Object.values(store.byPlate).filter(item=>item.active).map(item=>item.plateNormalized)}
export async function listLineReservationRecords(){const store=await readStore();return Object.values(store.byPlate).sort((a,b)=>(a.updatedAt>b.updatedAt?-1:1))}
export async function clearAllLineReservations(reason=""){const current=await readStore(),clearedAt=new Date().toISOString(),nextStore:LineReservationStore={byPlate:{}};await writeStore(nextStore);return{clearedAt,clearedCount:Object.keys(current.byPlate||{}).length,reason:String(reason||"").slice(0,120)}}
export async function applyLineReservationCommand(input:{text:string;sourceGroupId?:string;receivedAt?:string}){return applyLineReservationCommands([{text:input.text,sourceGroupId:input.sourceGroupId,receivedAt:input.receivedAt}])}
export async function applyLineReservationCommands(inputs:Array<{text:string;sourceGroupId?:string;receivedAt?:string}>){
 const normalizedInputs=inputs.map(input=>({text:String(input.text||""),sourceGroupId:String(input.sourceGroupId||""),receivedAt:input.receivedAt||new Date().toISOString()})).filter(input=>input.text.trim());if(!normalizedInputs.length)return null;
 const parsedCommands=normalizedInputs.flatMap(input=>parseLineReservationCommands(input.text).map(parsed=>({...parsed,sourceGroupId:input.sourceGroupId,receivedAt:input.receivedAt,sourceText:input.text})));if(!parsedCommands.length)return null;
 const store=await readStore(),applied:Array<{action:LineReservationAction;plate:string;plateNormalized:string;active:boolean}>=[];
 for(const parsed of parsedCommands){const plateNormalized=normalizePlateForMatch(parsed.plate);if(!plateNormalized)continue;const current=store.byPlate[plateNormalized],record:LineReservationRecord={plate:parsed.plate,plateNormalized,active:parsed.action==="reserve",updatedAt:parsed.receivedAt,sourceGroupId:parsed.sourceGroupId,sourceText:parsed.sourceText};store.byPlate[plateNormalized]={...current,...record};applied.push({action:parsed.action,plate:parsed.plate,plateNormalized,active:record.active})}
 if(!applied.length)return null;await writeStore(store);console.info("[line-reservation] persisted",applied.map(x=>`${x.action}:${x.plateNormalized}`).join(","));return applied.length===1?applied[0]:{applied};
}
