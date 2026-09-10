import { NextRequest, NextResponse } from 'next/server';
import { listBookingDeliveryRecordsWithRevision } from '@/lib/booking-delivery';
import { updateRddWorkspaceRecord } from '@/lib/rdd-workspace-write';
import { appendRddActivity } from '@/lib/rdd-activity';
import { pushLineText } from '@/lib/line';
import { getRddLineSettings } from '@/lib/rdd-line-settings';
import { prepStatusForRecord, RDD_PREP_LABELS } from '@/lib/rdd-phase3c';
import { readJsonStore, writeJsonStore } from '@/lib/json-store';
import type { RddWorkspaceChanges } from '@/lib/rdd-workspace-fields';

export const dynamic = 'force-dynamic';
const customFile = 'rdd-custom-tasks.json';
type CustomTask = { id:string; title:string; done:boolean; createdAt:string; updatedAt:string };
type CustomStore = Record<string, CustomTask[]>;
const fields = ['washStatus','stickerStatus','oilStatus','batteryStatus','taxStatus','insuranceStatus'] as const;
function norm(v:unknown){return String(v||'').normalize('NFKC').toLowerCase().replace(/[^0-9a-zก-๙]/g,'')}
async function locate(id:string){ const snapshot=await listBookingDeliveryRecordsWithRevision(); const record=snapshot.records.find(r=>String(r.id)===id); return {snapshot,record}; }
function labels(record:any){const p=prepStatusForRecord(record); return {washStatus:p.washStatus||'',stickerStatus:p.stickerStatus||'',oilStatus:p.oilStatus||'',batteryStatus:p.batteryStatus||'',taxStatus:p.taxStatus||'',insuranceStatus:p.insuranceStatus||''};}
function labelFor(field:string,value:string){const map=(RDD_PREP_LABELS as any)[field]||{};return map[value]||value;}

export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('id')||''; const plate=req.nextUrl.searchParams.get('plate')||''; const customer=req.nextUrl.searchParams.get('customer')||'';
 const snapshot=await listBookingDeliveryRecordsWithRevision();
 let record=id?snapshot.records.find(r=>String(r.id)===id):undefined;
 if(!record && plate){const pn=norm(plate),cn=norm(customer); const matches=snapshot.records.filter(r=>norm(r.plate)===pn && (!cn||norm(r.customerName).includes(cn))); if(matches.length===1) record=matches[0];}
 if(!record) return NextResponse.json({error:'ไม่พบเคส หรือพบทะเบียนซ้ำ กรุณาเปิดจาก LINE ใหม่'},{status:404});
 const custom=await readJsonStore<CustomStore>(customFile,{});
 return NextResponse.json({id:String(record.id),plate:record.plate||'',customerName:record.customerName||'',revision:snapshot.revision,statuses:labels(record),customTasks:custom[String(record.id)]||[]});
}

export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null) as any; if(!body||typeof body!=='object') return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});
 const id=String(body.id||''); const {snapshot,record}=await locate(id); if(!record) return NextResponse.json({error:'ไม่พบเคส'},{status:404});
 const changes:RddWorkspaceChanges={}; const incoming=body.changes&&typeof body.changes==='object'?body.changes:{};
 for(const field of fields) if(typeof incoming[field]==='string') (changes as any)[field]=incoming[field];
 const current=labels(record); for(const field of fields) if((changes as any)[field]===current[field]) delete (changes as any)[field];
 const customStore=await readJsonStore<CustomStore>(customFile,{}); const oldCustom=customStore[id]||[]; const now=new Date().toISOString();
 const requested=Array.isArray(body.customTasks)?body.customTasks:[];
 const nextCustom:CustomTask[]=requested.slice(0,50).map((t:any,i:number)=>{const old=oldCustom.find(x=>x.id===String(t.id||'')); const title=String(t.title||'').trim().slice(0,120); return {id:old?.id||String(t.id||`task-${Date.now()}-${i}`),title,done:Boolean(t.done),createdAt:old?.createdAt||now,updatedAt:now};}).filter(t=>t.title);
 const customChanged=JSON.stringify(oldCustom.map(x=>[x.id,x.title,x.done]))!==JSON.stringify(nextCustom.map(x=>[x.id,x.title,x.done]));
 let result:any=null;
 if(Object.keys(changes).length){ result=await updateRddWorkspaceRecord({id,expectedRevision:String(body.expectedRevision||snapshot.revision),changes,actor:{id:'line-task-panel',role:'sales'}}); await appendRddActivity(null,{action:'booking_delivery_updated',targetType:'booking_delivery',targetId:id,source:'line',before:result.before,after:result.after,metadata:{changedFields:result.changedFields,lineTaskPanel:true}}).catch(()=>undefined); }
 if(customChanged){customStore[id]=nextCustom;await writeJsonStore(customFile,customStore);}
 if(!result&&!customChanged) return NextResponse.json({error:'ไม่มีข้อมูลที่เปลี่ยนแปลง'},{status:400});
 const lines:string[]=[]; for(const field of fields){const value=(changes as any)[field]; if(value) lines.push(`• ${field==='washStatus'?'ล้างรถ':field==='stickerStatus'?'ลอกสติ๊กเกอร์':field==='oilStatus'?'น้ำมันเครื่อง':field==='batteryStatus'?'แบตเตอรี่':field==='taxStatus'?'ภาษี':'ประกัน'} → ${labelFor(field,value)}`);}
 const oldMap=new Map(oldCustom.map(x=>[x.id,x])); for(const t of nextCustom){const old=oldMap.get(t.id); if(!old||old.title!==t.title||old.done!==t.done) lines.push(`• ${t.title} → ${t.done?'เรียบร้อย ✅':'ยังไม่เรียบร้อย ⏳'}`);}
 const settings=await getRddLineSettings(); let lineSent=false; if(settings.enabled&&settings.groupId){try{await pushLineText(settings.groupId,`✅ อัปเดตงาน ${record.plate||'-'} · ${record.customerName||'-'}\n${lines.join('\n')}\n\nอัปเดตจาก BIG CAR RDD`);lineSent=true;}catch{lineSent=false;}}
 const latest=result?.record||record; return NextResponse.json({ok:true,lineSent,revision:result?.revision||snapshot.revision,statuses:labels(latest),customTasks:nextCustom,changedCount:lines.length});
}
