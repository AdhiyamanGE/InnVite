import React, { useState } from 'react';
import { SIDES, SIDE_MAP } from '../lib/constants.js';
import { Row, Spacer, Stat, Btn, Empty, miniBtn } from '../components/UI.jsx';

export default function AllocateTab({
  result, guests, rooms,
  runAllocation, updateResult,
  readOnly = false, showAlert, showConfirm,
}) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [moving, setMoving] = useState(null);
  const [running, setRunning] = useState(false);

  const isReadOnly = readOnly || !runAllocation;
  const confirmed = guests.filter(g => g.confirmed);

  const placed = result
    ? result.placed.map(entry => {
        const liveRoom = rooms.find(r=>r.id===entry.room.id);
        if (!liveRoom) return null;
        const liveGuests = entry.guests.map(g=>guests.find(x=>x.id===g.id)).filter(x=>x?.confirmed);
        if (!liveGuests.length) return null;
        return { room: liveRoom, guests: liveGuests };
      }).filter(Boolean)
    : [];

  const unplaced = result
    ? result.unplaced.map(g=>guests.find(x=>x.id===g.id)).filter(x=>x?.confirmed)
    : [];

  if (!result) {
    return (
      <div style={{textAlign:'center',padding:'60px 20px'}}>
        <div style={{fontSize:50,marginBottom:14}}>✨</div>
        <div style={{fontSize:16,color:'#c8956c',marginBottom:8,fontWeight:'bold'}}>Ready to Allocate</div>
        <div style={{fontSize:13,color:'#bbb',marginBottom:24,lineHeight:1.6}}>
          {confirmed.length} confirmed guests · {rooms.length} rooms available
        </div>
        {isReadOnly ? (
          <div style={{fontSize:13,color:'#aaa'}}>Allocation not run yet.</div>
        ) : confirmed.length===0||rooms.length===0 ? (
          <div style={{fontSize:13,color:'#aaa'}}>Add at least one confirmed guest and one room first.</div>
        ) : (
          <Btn large onClick={handleRun}>Run Room Allocation</Btn>
        )}
      </div>
    );
  }

  async function handleRun() {
    if (isReadOnly) return;
    setRunning(true); setOverrideMode(false); setMoving(null);
    await runAllocation();
    setRunning(false);
  }

  function handlePlaceHere(toRoomId) {
    if (!moving) return;
    moving.fromRoomId === '__unplaced__' ? doMoveFromUnplaced(toRoomId) : doMove(toRoomId);
  }

  async function doMove(toRoomId) {
    if (!moving) return;
    const { guestId, fromRoomId } = moving;
    if (toRoomId===fromRoomId) { setMoving(null); return; }
    const guest = confirmed.find(g=>g.id===guestId);
    if (!guest) { await showAlert('Guest no longer exists.'); setMoving(null); return; }
    const targetEntry = placed.find(e=>e.room.id===toRoomId);
    const targetRoom  = rooms.find(r=>r.id===toRoomId);
    if (!targetRoom) { await showAlert('Target room no longer exists.'); setMoving(null); return; }
    if (targetEntry && targetEntry.guests.length >= targetRoom.capacity) { await showAlert(`Room ${targetRoom.number} is full.`); return; }
    if (targetEntry && targetEntry.guests.length>0 && targetEntry.guests[0].side!==guest.side) {
      const ok = await showConfirm(`⚠ Room ${targetRoom.number} has guests from another side. Mix sides?`);
      if (!ok) return;
    }
    const newResult = applyMove(result, placed, fromRoomId, toRoomId, guestId, guest, rooms);
    if (updateResult) await updateResult(newResult);
    setMoving(null);
  }

  async function doMoveFromUnplaced(toRoomId) {
    if (!moving) return;
    const { guestId } = moving;
    const guest = confirmed.find(g=>g.id===guestId);
    if (!guest) { await showAlert('Guest no longer exists.'); setMoving(null); return; }
    const targetEntry = placed.find(e=>e.room.id===toRoomId);
    const targetRoom  = rooms.find(r=>r.id===toRoomId);
    if (!targetRoom) { await showAlert('Room no longer exists.'); setMoving(null); return; }
    if (targetEntry && targetEntry.guests.length >= targetRoom.capacity) { await showAlert(`Room full.`); return; }
    if (targetEntry && targetEntry.guests.length>0 && targetEntry.guests[0].side!==guest.side) {
      const ok = await showConfirm(`⚠ Room ${targetRoom.number} has guests from another side. Mix?`);
      if (!ok) return;
    }
    const newResult = {
      placed: (() => {
        const ex = placed.find(e=>e.room.id===toRoomId);
        if (ex) return placed.map(e=>e.room.id===toRoomId?{...e,guests:[...e.guests,guest]}:e);
        return [...placed, {room:targetRoom, guests:[guest]}];
      })(),
      unplaced: result.unplaced.filter(g=>g.id!==guestId),
    };
    if (updateResult) await updateResult(newResult);
    setMoving(null);
  }

  async function returnToUnplaced(guestId, fromRoomId) {
    const guest = confirmed.find(g=>g.id===guestId);
    if (!guest) return;
    const newResult = {
      placed: placed.map(e=>e.room.id===fromRoomId?{...e,guests:e.guests.filter(g=>g.id!==guestId)}:e).filter(e=>e.guests.length>0),
      unplaced: [...result.unplaced, guest],
    };
    if (updateResult) await updateResult(newResult);
    setMoving(null);
  }

  const allPlacedGuests = placed.flatMap(e=>e.guests);
  const usedRoomIds = new Set(placed.map(e=>e.room.id));
  const emptyRooms  = rooms.filter(r=>!usedRoomIds.has(r.id));
  const isMoving    = moving !== null;
  const movingGuest = isMoving ? confirmed.find(g=>g.id===moving.guestId) : null;

  const _claimed = new Set();
  const byS = SIDES.map(s => {
    const entries = placed.filter(e=>!_claimed.has(e.room.id)&&e.guests.some(g=>g.side===s.id));
    entries.forEach(e=>_claimed.add(e.room.id));
    return {...s, entries};
  }).filter(x=>x.entries.length>0);

  return (
    <div>
      <Row style={{marginBottom:16,flexWrap:'wrap',gap:10}}>
        <Stat label="Rooms Used" value={placed.length} />
        <Stat label="Placed"     value={allPlacedGuests.length} />
        {unplaced.length>0 && <Stat label="⚠ Unplaced" value={unplaced.length} warn />}
        <Spacer />
        {!isReadOnly && (
          <Btn ghost small onClick={()=>{setOverrideMode(o=>!o);setMoving(null);}}>
            {overrideMode ? '✅ Done Editing' : '✏️ Manual Override'}
          </Btn>
        )}
        <Btn ghost small onClick={()=>window.print()}>🖨 Print</Btn>
        {!isReadOnly && <Btn small onClick={handleRun} disabled={running}>{running?'Running…':'🔄 Re-run'}</Btn>}
      </Row>

      {overrideMode && !isReadOnly && (
        <div style={{background:'#fffbf0',border:'1.5px solid #f0c060',borderRadius:9,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#7a5c10'}}>
          <strong>✏️ Override Mode</strong> — Click <strong>Move</strong> next to a guest, then <strong>Place Here</strong>.
          {isMoving && movingGuest && (
            <span style={{marginLeft:10,background:'#f0c060',padding:'2px 10px',borderRadius:7,fontWeight:'bold'}}>
              Moving: {movingGuest.name} →
            </span>
          )}
        </div>
      )}

      {unplaced.length>0 && (
        <div style={{background:'#fff3e0',border:'1.5px solid #ffb74d',borderRadius:10,padding:'12px 16px',marginBottom:18}}>
          <div style={{fontWeight:'bold',color:'#e65100',marginBottom:9,fontSize:13}}>⚠ Unplaced guests:</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {unplaced.map(g => {
              const s = SIDE_MAP[g.side];
              const isSel = isMoving&&moving.guestId===g.id;
              return (
                <div key={g.id} style={{background:'#fff',border:`1.5px solid ${isSel?'#f0c060':'#ffcc80'}`,borderRadius:8,padding:'5px 11px',fontSize:12,display:'flex',alignItems:'center',gap:7}}>
                  <span>{g.gender==='Female'?'👩':'👨'} <strong>{g.name}</strong></span>
                  {s&&<span style={{color:s.color,fontSize:10}}>{s.label}</span>}
                  {overrideMode&&!isReadOnly&&!isMoving&&<button onClick={()=>setMoving({guestId:g.id,fromRoomId:'__unplaced__'})} style={miniBtn('#fff9e0','#a07830')}>Pick Up</button>}
                  {overrideMode&&isSel&&<button onClick={()=>setMoving(null)} style={miniBtn('#eee','#666')}>Cancel</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {byS.map(s => (
        <div key={s.id} style={{marginBottom:26}}>
          <Row style={{marginBottom:10}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0}}/>
            <span style={{fontWeight:'bold',fontSize:14,color:s.color}}>{s.label}</span>
            <span style={{color:'#bbb',fontSize:11}}>{s.entries.reduce((n,e)=>n+e.guests.length,0)} guests · {s.entries.length} rooms</span>
          </Row>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:12}}>
            {s.entries.map(entry => {
              const {room, guests:rg} = entry;
              const isMixed  = rg.length>0&&rg.some(g=>g.side!==rg[0].side);
              const isFull   = rg.length>=room.capacity;
              const canPlace = !isReadOnly&&overrideMode&&isMoving&&!isFull&&moving.fromRoomId!==room.id;
              return (
                <div key={room.id} style={{background:'#fff',borderRadius:11,border:`1.5px solid ${isMixed?'#ff7043':s.color+'33'}`,borderTop:`4px solid ${isMixed?'#ff7043':s.color}`,padding:'12px 14px',boxShadow:'0 2px 8px rgba(0,0,0,.04)',position:'relative'}}>
                  {isMixed&&<div style={{position:'absolute',top:0,right:10,background:'#ff7043',color:'#fff',fontSize:9,padding:'1px 7px',borderRadius:'0 0 5px 5px',letterSpacing:1}}>MIXED</div>}
                  <Row style={{marginBottom:8}}>
                    <span style={{fontSize:15,fontWeight:'bold'}}>Room {room.number}</span>
                    <span style={{fontSize:10,color:'#bbb'}}>{room.floor}</span>
                    <Spacer/>
                    <span style={{fontSize:11,color:isFull?'#6d8b74':'#c8956c'}}>{rg.length}/{room.capacity} 🛏</span>
                  </Row>
                  {rg.map((g,i) => {
                    const gs = SIDE_MAP[g.side];
                    const isMover = isMoving&&moving.guestId===g.id;
                    return (
                      <div key={g.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderTop:i>0?'1px solid #f5f0ee':'none',opacity:isMover?.4:1}}>
                        <span style={{fontSize:14,flexShrink:0}}>{g.gender==='Female'?'👩':'👨'}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.name}</div>
                          <div style={{fontSize:10,color:gs?gs.color:'#aaa'}}>{gs?gs.label:''}{g.family?' · '+g.family:''}</div>
                        </div>
                        {!isReadOnly&&overrideMode&&!isMoving&&<button onClick={()=>setMoving({guestId:g.id,fromRoomId:room.id})} style={miniBtn('#e8f4ff','#5c7fa3')}>Move</button>}
                        {!isReadOnly&&overrideMode&&isMover&&<button onClick={()=>setMoving(null)} style={miniBtn('#eee','#666')}>Cancel</button>}
                        {!isReadOnly&&overrideMode&&isMoving&&!isMover&&<button onClick={()=>returnToUnplaced(g.id,room.id)} style={miniBtn('#fff3e0','#a07850')} title="Return to Unplaced">↩</button>}
                      </div>
                    );
                  })}
                  {canPlace&&<button onClick={()=>handlePlaceHere(room.id)} style={{marginTop:9,width:'100%',padding:'7px',background:'#e8f5e9',border:'1.5px dashed #6d8b74',borderRadius:6,color:'#6d8b74',fontWeight:'bold',fontSize:12,cursor:'pointer',fontFamily:'Georgia,serif'}}>➕ Place Here</button>}
                  {room.notes&&<div style={{fontSize:10,color:'#bbb',marginTop:7,borderTop:'1px solid #f5f0ee',paddingTop:5}}>📝 {room.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!isReadOnly&&overrideMode&&isMoving&&emptyRooms.length>0&&(
        <div style={{marginTop:10}}>
          <div style={{fontWeight:'bold',color:'#bbb',fontSize:11,letterSpacing:2,marginBottom:9,textTransform:'uppercase'}}>Empty Rooms</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:9}}>
            {emptyRooms.map(r=>(
              <div key={r.id} style={{background:'#fafafa',border:'1.5px dashed #ddd',borderRadius:9,padding:'9px 14px',fontSize:12,display:'flex',alignItems:'center',gap:10}}>
                <strong>Room {r.number}</strong><span style={{color:'#bbb'}}>{r.floor} · cap {r.capacity}</span>
                <button onClick={()=>handlePlaceHere(r.id)} style={miniBtn('#e8f5e9','#6d8b74')}>➕ Place Here</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {placed.length===0&&<Empty>No guests allocated yet. {!isReadOnly?'Click Re-run to allocate.':'Allocation not run yet.'}</Empty>}
    </div>
  );
}

function applyMove(result, placed, fromRoomId, toRoomId, guestId, guest, rooms) {
  let newPlaced = placed.map(e=>e.room.id===fromRoomId?{...e,guests:e.guests.filter(g=>g.id!==guestId)}:e).filter(e=>e.guests.length>0);
  const ex = newPlaced.find(e=>e.room.id===toRoomId);
  if (ex) { newPlaced = newPlaced.map(e=>e.room.id===toRoomId?{...e,guests:[...e.guests,guest]}:e); }
  else { newPlaced = [...newPlaced,{room:rooms.find(r=>r.id===toRoomId),guests:[guest]}]; }
  return { placed: newPlaced, unplaced: result.unplaced };
}
