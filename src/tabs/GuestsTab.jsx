import React, { useState } from 'react';
import { SIDES, SIDE_MAP, GENDERS } from '../lib/constants.js';
import { Card, Grid2, Grid3, Row, Spacer, Input, Select, Btn, Empty, ClearAll } from '../components/UI.jsx';

const EMPTY_FORM = { name: '', gender: 'Male', side: 'bride_dad', family: '', confirmed: true };

export default function GuestsTab({
  guests, addGuest, editGuest, removeGuest,
  clearGuestsBySide, clearAllGuests, dropPairsForGuest,
  locks, currentUserId, readOnly = false, editorName,
  showAlert,
}) {
  const [form,   setFormState] = useState(EMPTY_FORM);
  const [editId, setEditId]    = useState(null);
  const [search, setSearch]    = useState('');
  const [saving, setSaving]    = useState(false);

  const isReadOnly = readOnly || !editGuest;

  function setField(k, v) { setFormState(f => ({ ...f, [k]: v })); }
  function cancel() { setFormState(EMPTY_FORM); setEditId(null); }

  function startEdit(g) {
    if (isReadOnly) return;
    // Check lock
    if (locks?.isLockedByOther('guest', g.id)) {
      const info = locks.getLockInfo('guest', g.id);
      showAlert(`⚠️ "${g.name}" is being edited by ${info?.locked_by_name || 'another user'}.`);
      return;
    }
    setFormState({ name: g.name, gender: g.gender, side: g.side, family: g.family||'', confirmed: g.confirmed });
    setEditId(g.id);
  }

  async function save() {
    if (!form.name.trim() || isReadOnly) return;
    setSaving(true);

    if (editId) {
      // Acquire lock if using shared editing
      if (locks) {
        const acq = await locks.acquireLock('guest', editId);
        if (!acq.success) {
          await showAlert(`⚠️ Cannot save — ${acq.lockedByName} is currently editing this guest.`);
          setSaving(false); return;
        }
      }
      const original = guests.find(g => g.id === editId);
      const { error } = await editGuest(editId, form);
      if (locks) locks.releaseLock('guest', editId);
      if (error) { await showAlert('Save failed: ' + (error.message || error)); }
      else {
        if (original?.side !== form.side) await dropPairsForGuest?.(editId);
        cancel();
      }
    } else if (addGuest) {
      const { error } = await addGuest(form);
      if (error) await showAlert('Save failed: ' + (error.message || error));
      else cancel();
    }
    setSaving(false);
  }

  async function del(id) {
    if (isReadOnly) return;
    if (locks?.isLockedByOther('guest', id)) {
      const info = locks.getLockInfo('guest', id);
      await showAlert(`Cannot delete — being edited by ${info?.locked_by_name || 'another user'}.`);
      return;
    }
    const { error } = await removeGuest(id);
    if (error) await showAlert('Delete failed: ' + (error.message || error));
    if (id === editId) cancel();
  }

  async function handleClearSide(sideId) {
    if (isReadOnly || !clearGuestsBySide) return;
    const { error } = await clearGuestsBySide(sideId);
    if (error) await showAlert('Clear failed: ' + (error.message || error));
    if (editId && guests.find(g=>g.id===editId)?.side === sideId) cancel();
  }

  async function handleClearAll() {
    if (isReadOnly || !clearAllGuests) return;
    const { error } = await clearAllGuests();
    if (error) await showAlert('Clear failed: ' + (error.message || error));
    cancel();
  }

  const filtered = guests.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.family||'').toLowerCase().includes(search.toLowerCase())
  );

  const bySide = SIDES.map(s => ({ ...s, list: filtered.filter(g=>g.side===s.id) })).filter(s=>s.list.length>0);
  const confirmed = guests.filter(g=>g.confirmed).length;

  function lockBadge(g) {
    if (!locks) return null;
    const lock = locks.getLockInfo('guest', g.id);
    if (!lock) return null;
    const isMine = lock.locked_by === currentUserId;
    return (
      <span style={{ background: isMine ? '#fff9c4' : '#fce4ec', color: isMine ? '#7a5c10' : '#c62828',
                     fontSize: 9, padding: '1px 6px', borderRadius: 8, fontWeight: 'bold', flexShrink: 0 }}>
        {isMine ? '🔒 You' : `🔒 ${lock.locked_by_name}`}
      </span>
    );
  }

  function editBadge(g) {
    if (!g.last_edited_by || g.last_edited_by === g.user_id) return null;
    const editorLabel = g.last_edited_by === currentUserId ? 'you' : (editorName || 'shared user');
    return (
      <span style={{ background: '#e3f2fd', color: '#1565c0', fontSize: 9,
                     padding: '1px 6px', borderRadius: 8, fontWeight: 'bold', flexShrink: 0 }}>
        ✏️ {editorLabel}
      </span>
    );
  }

  return (
    <div>
      {/* ── Form (hidden in read-only mode) ── */}
      {!isReadOnly && (
        <Card title={editId ? 'Edit Guest' : 'Add Guest'}>
          <Grid3>
            <Input label="Name" value={form.name} onChange={v=>setField('name',v)} placeholder="Full name" />
            <Select label="Side" value={form.side} onChange={v=>setField('side',v)} options={SIDES.map(s=>({value:s.id,label:s.label}))} />
            <Select label="Gender" value={form.gender} onChange={v=>setField('gender',v)} options={GENDERS.map(g=>({value:g,label:g}))} />
            <Input label="Family Group" value={form.family} onChange={v=>setField('family',v)} placeholder="e.g. Smith" />
            <div style={{paddingTop:14}}>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer'}}>
                <input type="checkbox" checked={form.confirmed} onChange={e=>setField('confirmed',e.target.checked)} />
                Confirmed
              </label>
            </div>
          </Grid3>
          <Row style={{marginTop:12,gap:8}}>
            <Btn onClick={save} disabled={!form.name.trim()||saving}>
              {saving ? 'Saving…' : editId ? '💾 Update' : '➕ Add Guest'}
            </Btn>
            {editId && <Btn ghost small onClick={cancel}>Cancel</Btn>}
          </Row>
        </Card>
      )}

      {/* ── Stats + search ── */}
      {guests.length > 0 && (
        <Row style={{marginBottom:12,flexWrap:'wrap',gap:8}}>
          <span style={{fontSize:12,color:'#aaa'}}>{guests.length} total · {confirmed} confirmed</span>
          <Spacer />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
            style={{padding:'5px 10px',borderRadius:7,border:'1.5px solid #e8ddd8',fontSize:13,fontFamily:'Georgia,serif',outline:'none',width:180}} />
        </Row>
      )}

      {/* ── Guest list ── */}
      {bySide.map(s => (
        <div key={s.id} style={{marginBottom:20}}>
          <Row style={{marginBottom:8}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:s.color}} />
            <span style={{fontWeight:'bold',fontSize:13,color:s.color}}>{s.label}</span>
            <span style={{fontSize:11,color:'#bbb'}}>{s.list.length} guests</span>
            <Spacer />
            {!isReadOnly && clearGuestsBySide && (
              <ClearAll label={`${s.list.length} ${s.label} guests`} color={s.color} onClear={()=>handleClearSide(s.id)} />
            )}
          </Row>
          <Grid2>
            {s.list.map(g => {
              const isLocked = locks?.isLockedByOther('guest', g.id);
              return (
                <div key={g.id} style={{
                  background: editId===g.id ? s.bg : isLocked ? '#fce4ec' : g.last_edited_by && g.last_edited_by!==g.user_id ? '#e8f4ff' : '#fff',
                  borderRadius:9, padding:'10px 13px',
                  border:`1.5px solid ${editId===g.id ? s.color : isLocked ? '#ef9a9a' : g.last_edited_by && g.last_edited_by!==g.user_id ? '#90caf9' : '#f0ddd8'}`,
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{fontSize:18}}>{g.gender==='Female'?'👩':g.gender==='Other'?'🧑':'👨'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {g.name}
                      {!g.confirmed && <span style={{fontSize:10,color:'#ffb300',marginLeft:5}}>⏳</span>}
                    </div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:2}}>
                      {g.family && <span style={{fontSize:10,color:'#bbb'}}>{g.family}</span>}
                      {lockBadge(g)}
                      {editBadge(g)}
                    </div>
                  </div>
                  {!isReadOnly && !isLocked && (
                    <>
                      <button onClick={()=>startEdit(g)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:2}}>✏️</button>
                      <button onClick={()=>del(g.id)}    style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:2}}>🗑</button>
                    </>
                  )}
                  {isLocked && <span style={{fontSize:12}}>🔒</span>}
                </div>
              );
            })}
          </Grid2>
        </div>
      ))}

      {!isReadOnly && guests.length > 0 && clearAllGuests && (
        <Row style={{justifyContent:'center',marginTop:8}}>
          <ClearAll label={`all ${guests.length} guests`} onClear={handleClearAll} />
        </Row>
      )}

      {guests.length === 0 && <Empty>{isReadOnly ? 'No guests in this dataset.' : 'No guests yet. Add the first one above.'}</Empty>}
      {guests.length > 0 && filtered.length === 0 && <Empty>No guests match "{search}".</Empty>}
    </div>
  );
}
