import React, { useState } from 'react';
import { FLOORS } from '../lib/constants.js';
import { Card, Grid2, Grid3, Row, Spacer, Input, Select, Btn, Empty, ClearAll } from '../components/UI.jsx';

const EMPTY_FORM = { number: '', floor: 'Ground', capacity: 2, notes: '' };

export default function RoomsTab({
  rooms, addRoom, editRoom, removeRoom, clearAllRooms,
  locks, currentUserId, readOnly = false, editorName,
  showAlert,
}) {
  const [form,      setFormState] = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);
  const [roomError, setRoomError] = useState('');
  const [saving,    setSaving]    = useState(false);

  const isReadOnly = readOnly || !editRoom;

  function setField(k, v) { setFormState(f => ({ ...f, [k]: v })); }
  function cancel() { setFormState(EMPTY_FORM); setEditId(null); setRoomError(''); }

  function startEdit(r) {
    if (isReadOnly) return;
    if (locks?.isLockedByOther('room', r.id)) {
      const info = locks.getLockInfo('room', r.id);
      showAlert(`⚠️ Room ${r.number} is being edited by ${info?.locked_by_name || 'another user'}.`);
      return;
    }
    setFormState({ number: r.number, floor: r.floor, capacity: r.capacity, notes: r.notes||'' });
    setEditId(r.id);
    setRoomError('');
  }

  async function save() {
    if (!form.number.trim() || isReadOnly) return;
    const dup = rooms.some(r => r.number.trim()===form.number.trim() && r.id!==editId);
    if (dup) { setRoomError(`Room "${form.number}" already exists.`); return; }
    setRoomError('');
    const payload = { ...form, capacity: Math.max(1, Number(form.capacity)||1) };
    setSaving(true);
    if (editId) {
      if (locks) {
        const acq = await locks.acquireLock('room', editId);
        if (!acq.success) { await showAlert(`Cannot save — ${acq.lockedByName} is editing this room.`); setSaving(false); return; }
      }
      const { error } = await editRoom(editId, payload);
      if (locks) locks.releaseLock('room', editId);
      if (error) await showAlert('Save failed: ' + (error.message||error));
      else cancel();
    } else if (addRoom) {
      const { error } = await addRoom(payload);
      if (error) await showAlert('Save failed: ' + (error.message||error));
      else cancel();
    }
    setSaving(false);
  }

  async function del(id) {
    if (isReadOnly) return;
    if (locks?.isLockedByOther('room', id)) {
      const info = locks.getLockInfo('room', id);
      await showAlert(`Cannot delete — being edited by ${info?.locked_by_name||'another user'}.`); return;
    }
    const { error } = await removeRoom(id);
    if (error) await showAlert('Delete failed: ' + (error.message||error));
    if (id===editId) cancel();
  }

  async function handleClearAll() {
    if (isReadOnly || !clearAllRooms) return;
    const { error } = await clearAllRooms();
    if (error) await showAlert('Clear failed: ' + (error.message||error));
    cancel();
  }

  const byFloor = FLOORS.map(f => ({ floor: f, list: rooms.filter(r=>r.floor===f) })).filter(f=>f.list.length>0);
  const totalCap = rooms.reduce((n, r) => n+r.capacity, 0);

  function editBadge(r) {
    if (!r.last_edited_by || r.last_edited_by === r.user_id) return null;
    const label = r.last_edited_by === currentUserId ? 'you' : (editorName || 'shared user');
    return <span style={{background:'#e3f2fd',color:'#1565c0',fontSize:9,padding:'1px 6px',borderRadius:8,fontWeight:'bold',flexShrink:0}}>✏️ {label}</span>;
  }

  return (
    <div>
      {!isReadOnly && (
        <Card title={editId ? 'Edit Room' : 'Add Room'}>
          <Grid3>
            <Input label="Room Number / Name" value={form.number} onChange={v=>setField('number',v)} placeholder="e.g. 101" />
            <Select label="Floor" value={form.floor} onChange={v=>setField('floor',v)} options={FLOORS.map(f=>({value:f,label:f+' Floor'}))} />
            <div>
              <div style={{fontSize:11,fontWeight:'bold',letterSpacing:1,textTransform:'uppercase',color:'#b5838d',marginBottom:4}}>Capacity</div>
              <input type="number" min={1} max={20} value={form.capacity} onChange={e=>setField('capacity',e.target.value)}
                style={{width:'100%',padding:'7px 10px',borderRadius:7,border:'1.5px solid #e8ddd8',fontSize:14,fontFamily:'Georgia,serif',outline:'none'}} />
            </div>
            <Input label="Notes" value={form.notes} onChange={v=>setField('notes',v)} placeholder="Optional" />
          </Grid3>
          {roomError && <div style={{color:'#e53935',fontSize:12,marginTop:8}}>{roomError}</div>}
          <Row style={{marginTop:12,gap:8}}>
            <Btn onClick={save} disabled={!form.number.trim()||saving}>
              {saving ? 'Saving…' : editId ? '💾 Update' : '➕ Add Room'}
            </Btn>
            {editId && <Btn ghost small onClick={cancel}>Cancel</Btn>}
          </Row>
        </Card>
      )}

      {rooms.length > 0 && (
        <Row style={{marginBottom:12,flexWrap:'wrap',gap:8}}>
          <span style={{fontSize:12,color:'#aaa'}}>{rooms.length} rooms · {totalCap} capacity</span>
          <Spacer />
          {!isReadOnly && clearAllRooms && <ClearAll label={`all ${rooms.length} rooms`} onClear={handleClearAll} />}
        </Row>
      )}

      {byFloor.map(({floor, list}) => (
        <div key={floor} style={{marginBottom:20}}>
          <div style={{fontWeight:'bold',fontSize:12,color:'#aaa',letterSpacing:2,textTransform:'uppercase',marginBottom:8}}>{floor} Floor</div>
          <Grid2>
            {list.map(r => {
              const isLocked = locks?.isLockedByOther('room', r.id);
              const externalEdit = r.last_edited_by && r.last_edited_by !== r.user_id;
              return (
                <div key={r.id} style={{
                  background: editId===r.id ? '#fdf6f3' : isLocked ? '#fce4ec' : externalEdit ? '#e8f4ff' : '#fff',
                  borderRadius:9, padding:'10px 13px',
                  border:`1.5px solid ${editId===r.id ? '#c8956c' : isLocked ? '#ef9a9a' : externalEdit ? '#90caf9' : '#f0ddd8'}`,
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{fontSize:18}}>🛏</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:'bold'}}>Room {r.number}</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:2}}>
                      <span style={{fontSize:10,color:'#bbb'}}>Cap {r.capacity}{r.notes ? ` · ${r.notes}` : ''}</span>
                      {editBadge(r)}
                      {isLocked && (() => { const info = locks.getLockInfo('room',r.id); return (
                        <span style={{background:'#fce4ec',color:'#c62828',fontSize:9,padding:'1px 6px',borderRadius:8,fontWeight:'bold'}}>
                          🔒 {info?.locked_by_name||'locked'}
                        </span>
                      ); })()}
                    </div>
                  </div>
                  {!isReadOnly && !isLocked && (
                    <>
                      <button onClick={()=>startEdit(r)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:2}}>✏️</button>
                      <button onClick={()=>del(r.id)}    style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:2}}>🗑</button>
                    </>
                  )}
                  {isLocked && <span style={{fontSize:12}}>🔒</span>}
                </div>
              );
            })}
          </Grid2>
        </div>
      ))}
      {rooms.length === 0 && <Empty>{isReadOnly ? 'No rooms in this dataset.' : 'No rooms yet. Add the first one above.'}</Empty>}
    </div>
  );
}
