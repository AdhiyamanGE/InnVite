import React, { useState } from 'react';
import { SIDE_MAP } from '../lib/constants.js';
import { Card, Grid3, Row, Btn, Select, Empty } from '../components/UI.jsx';

export default function PairsTab({ guests, pairs, addPair, removePair, readOnly = false, showAlert }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [saving, setSaving] = useState(false);

  const isReadOnly = readOnly || !addPair;
  const confirmed = guests.filter(g => g.confirmed);
  const guestA = a ? confirmed.find(g => g.id === a) : null;
  const sideOfA = guestA?.side ?? null;
  const eligibleB = sideOfA ? confirmed.filter(g => g.side===sideOfA && g.id!==a) : confirmed;

  async function handleAdd() {
    if (!a || !b || a===b) return;
    const gA = confirmed.find(g=>g.id===a);
    const gB = confirmed.find(g=>g.id===b);
    if (!gA || !gB || gA.side!==gB.side) return;
    const dup = pairs.some(p=>(p.a===a&&p.b===b)||(p.a===b&&p.b===a));
    if (dup) return;
    setSaving(true);
    const { error } = await addPair(a, b);
    if (error) await showAlert('Failed: '+(error.message||error));
    else { setA(''); setB(''); }
    setSaving(false);
  }

  async function handleRemove(id) {
    if (isReadOnly || !removePair) return;
    const { error } = await removePair(id);
    if (error) await showAlert('Failed: '+(error.message||error));
  }

  function gName(id) {
    const g = guests.find(x=>x.id===id);
    if (!g) return '?';
    return g.confirmed ? g.name : g.name+' ⚠ pending';
  }
  function gSide(id) {
    const g = guests.find(x=>x.id===id);
    return g ? SIDE_MAP[g.side] : null;
  }

  return (
    <div>
      {!isReadOnly && (
        <Card title="Set Preferred Room Pairs">
          <p style={{fontSize:13,color:'#888',marginBottom:14,lineHeight:1.5}}>
            Both guests must be from the <strong>same side</strong>. These are always honoured first during allocation.
          </p>
          <Grid3 style={{alignItems:'end'}}>
            <Select label="Guest A" value={a} onChange={v=>{setA(v);setB('');}}
              options={[{value:'',label:'— Select Guest A —'},...confirmed.map(g=>({value:g.id,label:`${g.name} (${SIDE_MAP[g.side]?.label||g.side})`}))]} />
            <Select label="Guest B (same side)" value={b} onChange={setB}
              options={[{value:'',label:'— Select Guest B —'},...eligibleB.map(g=>({value:g.id,label:`${g.name} (${SIDE_MAP[g.side]?.label||g.side})`}))]} />
            <div style={{paddingTop:14}}>
              <Btn onClick={handleAdd} disabled={!a||!b||saving}>{saving?'Saving…':'Add Pair'}</Btn>
            </div>
          </Grid3>
        </Card>
      )}

      {pairs.map(p => {
        const s = gSide(p.a);
        return (
          <div key={p.id} style={{
            display:'flex', alignItems:'center', background:'#fff', borderRadius:8,
            padding:'10px 14px', marginBottom:7,
            border:`1px solid ${s?s.color+'33':'#eee'}`, borderLeft:`4px solid ${s?s.color:'#eee'}`, gap:10,
          }}>
            {s && <span style={{background:s.bg,color:s.color,padding:'2px 9px',borderRadius:12,fontSize:11,flexShrink:0}}>{s.label}</span>}
            <span style={{flex:1,fontSize:14}}>
              <strong>{gName(p.a)}</strong><span style={{color:'#ccc',margin:'0 4px'}}>+</span><strong>{gName(p.b)}</strong>
            </span>
            {!isReadOnly && removePair && <Btn danger small onClick={()=>handleRemove(p.id)}>Remove</Btn>}
          </div>
        );
      })}

      {!pairs.length && confirmed.length>0 && <Empty>No preferred pairs set.</Empty>}
      {!confirmed.length && <Empty>Add confirmed guests first, then set pairs here.</Empty>}
    </div>
  );
}
