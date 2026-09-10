'use client';

import { useMemo, useState } from 'react';

type Field = 'washStatus'|'stickerStatus'|'oilStatus'|'batteryStatus'|'taxStatus'|'insuranceStatus';
type Task = { field: Field; label: string; options: Array<{value:string;label:string}> };

const tasks: Task[] = [
  { field:'washStatus', label:'ล้างรถ', options:[{value:'not_ordered',label:'ยังไม่สั่ง'},{value:'ordered_waiting',label:'รอล้าง'},{value:'completed',label:'ล้างแล้ว ✓'}]},
  { field:'stickerStatus', label:'ลอกสติ๊กเกอร์', options:[{value:'not_checked',label:'ยังไม่ตรวจ'},{value:'no_sticker',label:'ไม่มีสติ๊กเกอร์'},{value:'ordered_waiting',label:'รอลอก'},{value:'completed',label:'ลอกแล้ว ✓'}]},
  { field:'oilStatus', label:'น้ำมันเครื่อง', options:[{value:'no_change',label:'ไม่เปลี่ยน'},{value:'change_waiting',label:'รอเปลี่ยน'},{value:'changed',label:'เปลี่ยนแล้ว ✓'}]},
  { field:'batteryStatus', label:'แบตเตอรี่', options:[{value:'not_checked',label:'ยังไม่ตรวจ'},{value:'good',label:'ปกติ ✓'},{value:'ordered_waiting',label:'รอเปลี่ยน'},{value:'replaced',label:'เปลี่ยนแล้ว ✓'}]},
  { field:'taxStatus', label:'ภาษี', options:[{value:'not_checked',label:'ยังไม่ตรวจ'},{value:'valid',label:'ไม่ขาด ✓'},{value:'renewal_ordered',label:'สั่งต่อแล้ว'}]},
  { field:'insuranceStatus', label:'ประกัน', options:[{value:'not_discussed',label:'ยังไม่คุย'},{value:'with_us',label:'ทำกับเรา ✓'},{value:'customer_self',label:'ลูกค้าทำเอง'}]},
];

export default function LineTaskPanelPage(){
  const params = useMemo(()=>typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search),[]);
  const plate = params.get('plate') || '7กร 2737';
  const customer = params.get('customer') || 'จันทร์เพ็ญ ทาทอง';
  const [values,setValues] = useState<Record<string,string>>({});
  const [saved,setSaved] = useState(false);
  const changed = Object.keys(values).length;
  return <main style={{minHeight:'100vh',background:'#f5f7f9',padding:'16px 14px 110px',fontFamily:'system-ui,-apple-system,sans-serif',color:'#17212b'}}>
    <section style={{maxWidth:620,margin:'0 auto'}}>
      <div style={{fontSize:13,color:'#667085',marginBottom:4}}>BIG CAR RDD · อัปเดตงานรถ</div>
      <h1 style={{fontSize:24,margin:'0 0 4px'}}>{plate}</h1>
      <div style={{fontSize:16,marginBottom:18}}>{customer}</div>
      {tasks.map(task=><div key={task.field} style={{background:'#fff',borderRadius:16,padding:14,marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{fontWeight:700,fontSize:17,marginBottom:10}}>{task.label}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{task.options.map(o=>{
          const active=values[task.field]===o.value;
          return <button key={o.value} onClick={()=>{setSaved(false);setValues(v=>({...v,[task.field]:o.value}))}} style={{border:active?'2px solid #06c755':'1px solid #d0d5dd',background:active?'#e9fbea':'#fff',borderRadius:12,padding:'10px 12px',fontSize:15,fontWeight:active?700:500}}>{o.label}</button>
        })}</div>
      </div>)}
      {saved && <div style={{background:'#e9fbea',borderRadius:12,padding:12,textAlign:'center',fontWeight:700}}>บันทึกเรียบร้อย ✓</div>}
    </section>
    <div style={{position:'fixed',left:0,right:0,bottom:0,background:'#fff',padding:'12px 14px calc(12px + env(safe-area-inset-bottom))',boxShadow:'0 -2px 10px rgba(0,0,0,.08)'}}>
      <button disabled={!changed} onClick={()=>setSaved(true)} style={{display:'block',width:'100%',maxWidth:620,margin:'0 auto',border:0,borderRadius:14,padding:14,fontSize:17,fontWeight:800,background:changed?'#06c755':'#d0d5dd',color:'#fff'}}>✓ บันทึกทั้งหมด {changed ? `(${changed} งาน)` : ''}</button>
    </div>
  </main>
}
