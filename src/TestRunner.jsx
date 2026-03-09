/**
 * TestRunner — only loaded when URL contains ?tests
 * Runs all 31 algorithm tests in-browser.
 */
import React, { useState } from 'react';
import { SIDES, SIDE_MAP } from './lib/constants.js';
import { allocate } from './lib/allocate.js';

// ── ID helpers ────────────────────────────────────────────────────────────────
let _id = 1;
const uid       = () => String(_id++);
const resetIds  = () => { _id = 1; };

// ── Test data builders ────────────────────────────────────────────────────────
function makeGuests(defs) {
  const guests = [];
  defs.forEach(d => {
    for (let i = 0; i < (d.count || 1); i++) {
      guests.push({
        id: uid(),
        name: `${d.family || d.side}-${i + 1}`,
        side: d.side,
        family: d.family || '',
        confirmed: d.confirmed !== false,
        gender: d.gender || 'Male',
      });
    }
  });
  return guests;
}

function makeRooms(defs) {
  const rooms = [];
  defs.forEach(d => {
    for (let i = 0; i < (d.count || 1); i++) {
      rooms.push({
        id: uid(),
        number: `R${uid()}`,
        floor: 'Ground',
        capacity: d.capacity,
        notes: '',
      });
    }
  });
  return rooms;
}

// ── Assertion helpers ─────────────────────────────────────────────────────────
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function allPlaced(r) { return r.unplaced.length === 0; }
function noSideMixing(r) {
  for (const e of r.placed) {
    const sides = [...new Set(e.guests.map(g => g.side))];
    if (sides.length > 1) return false;
  }
  return true;
}
function roomsUsed(r) { return r.placed.length; }
function guestInSameRoom(r, idA, idB) {
  return r.placed.some(e => {
    const ids = e.guests.map(g => g.id);
    return ids.includes(idA) && ids.includes(idB);
  });
}
function capacityRespected(r) {
  return r.placed.every(e => e.guests.length <= e.room.capacity);
}

// ── Test suite ────────────────────────────────────────────────────────────────
function buildTests() {
  return [
    // ── ALGORITHM ───────────────────────────────────────────────────────────
    {
      id: 'AL-01', category: 'Algorithm', name: 'Your exact scenario — 4 rooms used',
      run() {
        const guests = makeGuests([
          { side: 'bride_dad', family: 'DadFam1', count: 3 },
          { side: 'bride_dad', family: 'DadFam2', count: 2 },
          { side: 'bride_dad', family: 'DadFam3', count: 3 },
          { side: 'bride_mom', family: 'MomFam1', count: 2 },
          { side: 'bride_mom', family: 'MomFam2', count: 2 },
        ]);
        const rooms = makeRooms([{ capacity: 2, count: 3 }, { capacity: 3, count: 2 }, { capacity: 4, count: 1 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'All placed');
        assert(noSideMixing(result), 'No mixing');
      },
    },
    {
      id: 'AL-02', category: 'Algorithm', name: 'Strict side isolation — two sides, two rooms',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'FamA', count: 3 }, { side: 'bride_mom', family: 'FamB', count: 3 }]);
        const rooms  = makeRooms([{ capacity: 3, count: 2 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), 'No mixing'); assert(allPlaced(result), 'All placed');
        assert(roomsUsed(result) === 2, `Expected 2 rooms, got ${roomsUsed(result)}`);
      },
    },
    {
      id: 'AL-03', category: 'Algorithm', name: 'Minimum rooms — small families combined into one room',
      run() {
        const guests = makeGuests([{ side: 'bride_mom', family: 'MomFam1', count: 2 }, { side: 'bride_mom', family: 'MomFam2', count: 1 }, { side: 'bride_mom', family: 'MomFam3', count: 1 }]);
        const rooms  = makeRooms([{ capacity: 2, count: 2 }, { capacity: 4, count: 1 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'All placed'); assert(noSideMixing(result), 'No mixing');
        assert(roomsUsed(result) === 1, `Expected 1 room, got ${roomsUsed(result)}`);
      },
    },
    {
      id: 'AL-04', category: 'Algorithm', name: 'Smallest room selected for group (not largest)',
      run() {
        const guests = makeGuests([{ side: 'bride_mom', family: 'Fam', count: 2 }]);
        const rooms  = makeRooms([{ capacity: 2 }, { capacity: 3 }, { capacity: 4 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'Placed');
        assert(result.placed[0].room.capacity === 2, `Expected cap 2, got ${result.placed[0].room.capacity}`);
      },
    },
    {
      id: 'AL-05', category: 'Algorithm', name: 'Families are never split when room fits whole family',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'BigFam', count: 3 }]);
        const rooms  = makeRooms([{ capacity: 2 }, { capacity: 3 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'All placed');
        assert(result.placed.some(e => e.guests.length === 3), 'All 3 in same room');
      },
    },
    {
      id: 'AL-06', category: 'Algorithm', name: 'Family forced split when larger than any room',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'HugeFam', count: 5 }]);
        const rooms  = makeRooms([{ capacity: 3, count: 2 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'All 5 placed despite split'); assert(noSideMixing(result), 'No mixing');
        assert(roomsUsed(result) === 2, `Expected 2 rooms, got ${roomsUsed(result)}`);
      },
    },
    {
      id: 'AL-07', category: 'Algorithm', name: 'Unplaced guests when capacity insufficient',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'Fam', count: 5 }]);
        const rooms  = makeRooms([{ capacity: 3, count: 1 }]);
        const result = allocate(guests, rooms);
        assert(result.unplaced.length === 2, `Expected 2 unplaced, got ${result.unplaced.length}`);
        assert(result.placed[0].guests.length === 3, '3 in room');
      },
    },
    {
      id: 'AL-08', category: 'Algorithm', name: 'No rooms — all unplaced',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'Fam', count: 4 }]);
        const result = allocate(guests, []);
        assert(result.placed.length === 0, 'No placed'); assert(result.unplaced.length === 4, 'All unplaced');
      },
    },
    {
      id: 'AL-09', category: 'Algorithm', name: 'No confirmed guests — nothing allocated',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'Fam', count: 4 }]).map(g => ({ ...g, confirmed: false }));
        const rooms  = makeRooms([{ capacity: 4, count: 2 }]);
        const result = allocate(guests, rooms);
        assert(result.placed.length === 0, 'No rooms used'); assert(result.unplaced.length === 0, '0 unplaced');
      },
    },
    {
      id: 'AL-10', category: 'Algorithm', name: 'Mixed confirmed/pending — only confirmed placed',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'Fam', count: 4 }]);
        guests[0].confirmed = false; guests[1].confirmed = false;
        const rooms  = makeRooms([{ capacity: 4 }]);
        const result = allocate(guests, rooms);
        assert(result.placed[0].guests.length === 2, 'Only 2 confirmed placed');
        assert(result.unplaced.length === 0, 'No unplaced');
      },
    },
    {
      id: 'AL-11', category: 'Algorithm', name: 'All 6 sides — no cross-side mixing in any room',
      run() {
        const guests = makeGuests([
          { side: 'bride_dad',     family: 'DF',  count: 3 },
          { side: 'bride_mom',     family: 'MF',  count: 3 },
          { side: 'groom_dad',     family: 'GF',  count: 3 },
          { side: 'groom_mom',     family: 'GM',  count: 3 },
          { side: 'bride_friends', family: 'BF',  count: 3 },
          { side: 'groom_friends', family: 'GrF', count: 3 },
        ]);
        const rooms = makeRooms([{ capacity: 3, count: 6 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), 'No mixing across all 6 sides');
        assert(allPlaced(result), 'All 18 placed');
        assert(roomsUsed(result) === 6, `6 sides need 6 rooms, got ${roomsUsed(result)}`);
      },
    },
    {
      id: 'AL-12', category: 'Algorithm', name: 'Single guest single room',
      run() {
        const guests = makeGuests([{ side: 'bride_friends', count: 1 }]);
        const rooms  = makeRooms([{ capacity: 2 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), '1 placed'); assert(result.placed[0].guests.length === 1, 'Exactly 1 in room');
      },
    },
    {
      id: 'AL-13', category: 'Algorithm', name: 'Exact capacity fit — 100% room occupancy',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'F1', count: 2 }, { side: 'bride_dad', family: 'F2', count: 2 }]);
        const rooms  = makeRooms([{ capacity: 2, count: 2 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'All placed');
        result.placed.forEach(e => assert(e.guests.length === e.room.capacity, `Room ${e.room.number} should be full`));
      },
    },
    {
      id: 'AL-14', category: 'Algorithm', name: 'Capacity not exceeded in any room',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'F1', count: 5 }, { side: 'bride_dad', family: 'F2', count: 5 }]);
        const rooms  = makeRooms([{ capacity: 3, count: 4 }]);
        const result = allocate(guests, rooms);
        assert(capacityRespected(result), 'Capacity respected');
      },
    },
    // ── PAIRS ────────────────────────────────────────────────────────────────
    {
      id: 'PR-01', category: 'Pairs', name: 'Preferred pair placed in same room',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'Fam', count: 4 }]);
        const [a, b] = [guests[0].id, guests[3].id];
        const rooms  = makeRooms([{ capacity: 2, count: 3 }]);
        const result = allocate(guests, rooms, [{ a, b }]);
        assert(guestInSameRoom(result, a, b), 'Pair in same room');
      },
    },
    {
      id: 'PR-02', category: 'Pairs', name: 'Pending pair member — pair not honored, confirmed guest still placed',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'F1', count: 2 }]);
        guests[1].confirmed = false;
        const [a, b] = [guests[0].id, guests[1].id];
        const rooms  = makeRooms([{ capacity: 2 }]);
        const result = allocate(guests, rooms, [{ a, b }]);
        assert(result.placed.length === 1, 'One room used');
        assert(result.placed[0].guests.some(g => g.id === a), 'Confirmed guest placed');
      },
    },
    {
      id: 'PR-03', category: 'Pairs', name: 'Multiple pairs honored simultaneously',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', count: 4 }]);
        const [a, b, c, d] = guests.map(g => g.id);
        const rooms  = makeRooms([{ capacity: 2, count: 3 }]);
        const result = allocate(guests, rooms, [{ a, b }, { a: c, b: d }]);
        assert(guestInSameRoom(result, a, b), 'First pair together');
        assert(guestInSameRoom(result, c, d), 'Second pair together');
      },
    },
    {
      id: 'PR-04', category: 'Pairs', name: 'Pair placed in smallest fitting room',
      run() {
        const guests = makeGuests([{ side: 'bride_mom', count: 2 }]);
        const [a, b] = guests.map(g => g.id);
        const rooms  = makeRooms([{ capacity: 2 }, { capacity: 4 }, { capacity: 3 }]);
        const result = allocate(guests, rooms, [{ a, b }]);
        assert(guestInSameRoom(result, a, b), 'Pair together');
        assert(result.placed[0].room.capacity === 2, `Expected cap 2, got ${result.placed[0].room.capacity}`);
      },
    },
    // ── SIDE ISOLATION ───────────────────────────────────────────────────────
    {
      id: 'SI-01', category: 'Side Isolation', name: '3 guests left over cannot enter another side\'s room',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'DF', count: 3 }, { side: 'bride_mom', family: 'MF', count: 4 }]);
        const rooms  = makeRooms([{ capacity: 4 }, { capacity: 2 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), 'No mixing even when capacity is tight');
      },
    },
    {
      id: 'SI-02', category: 'Side Isolation', name: 'Room locked to first side — subsequent side gets own room',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'DF', count: 2 }, { side: 'groom_dad', family: 'GF', count: 2 }]);
        const rooms  = makeRooms([{ capacity: 4 }, { capacity: 4 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), 'Each side owns its room'); assert(roomsUsed(result) === 2, '2 rooms');
      },
    },
    {
      id: 'SI-03', category: 'Side Isolation', name: 'All 6 sides never bleed into each other',
      run() {
        const guests = makeGuests([
          { side: 'bride_dad',     family: 'A', count: 2 },
          { side: 'bride_mom',     family: 'B', count: 2 },
          { side: 'groom_dad',     family: 'C', count: 2 },
          { side: 'groom_mom',     family: 'D', count: 2 },
          { side: 'bride_friends', family: 'E', count: 2 },
          { side: 'groom_friends', family: 'F', count: 2 },
        ]);
        const rooms = makeRooms([{ capacity: 2, count: 6 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), 'Zero cross-side mixing across all 6 sides');
        assert(allPlaced(result), 'All 12 placed');
        assert(roomsUsed(result) === 6, `6 sides need 6 rooms, got ${roomsUsed(result)}`);
      },
    },
    {
      id: 'SI-04', category: 'Side Isolation', name: "Groom's Mom Side isolated from all other sides",
      run() {
        const guests = makeGuests([{ side: 'groom_mom', family: 'GM', count: 3 }, { side: 'bride_dad', family: 'BD', count: 3 }]);
        const rooms  = makeRooms([{ capacity: 3, count: 2 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), "Groom's Mom must not mix"); assert(allPlaced(result), 'All 6 placed');
        assert(roomsUsed(result) === 2, '2 rooms');
      },
    },
    {
      id: 'SI-05', category: 'Side Isolation', name: "Groom's Friends Side isolated from all other sides",
      run() {
        const guests = makeGuests([{ side: 'groom_friends', family: 'GrF', count: 3 }, { side: 'bride_mom', family: 'BM', count: 3 }]);
        const rooms  = makeRooms([{ capacity: 3, count: 2 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), "Groom's Friends must not mix"); assert(allPlaced(result), 'All 6 placed');
        assert(roomsUsed(result) === 2, '2 rooms');
      },
    },
    // ── EDGE CASES ───────────────────────────────────────────────────────────
    {
      id: 'EC-01', category: 'Edge Cases', name: 'Empty guests and rooms',
      run() {
        const result = allocate([], []);
        assert(result.placed.length === 0, 'No placement'); assert(result.unplaced.length === 0, 'Nothing unplaced');
      },
    },
    {
      id: 'EC-02', category: 'Edge Cases', name: 'Single capacity rooms only',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', count: 3 }]);
        const rooms  = makeRooms([{ capacity: 1, count: 3 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'All 3 placed'); assert(roomsUsed(result) === 3, '3 rooms');
      },
    },
    {
      id: 'EC-03', category: 'Edge Cases', name: 'One huge room fits everyone',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'F1', count: 5 }, { side: 'bride_dad', family: 'F2', count: 5 }]);
        const rooms  = makeRooms([{ capacity: 10 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'All 10 placed'); assert(roomsUsed(result) === 1, '1 room');
      },
    },
    {
      id: 'EC-04', category: 'Edge Cases', name: 'Guest with no family treated as solo unit',
      run() {
        const guests = [
          { id: uid(), name: 'Solo A', side: 'bride_dad', family: '', confirmed: true, gender: 'Male' },
          { id: uid(), name: 'Solo B', side: 'bride_dad', family: '', confirmed: true, gender: 'Male' },
        ];
        const rooms  = makeRooms([{ capacity: 2 }]);
        const result = allocate(guests, rooms);
        assert(allPlaced(result), 'Both solos placed');
      },
    },
    {
      id: 'EC-05', category: 'Edge Cases', name: 'Re-run after cancellation reduces rooms used',
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'F1', count: 2 }, { side: 'bride_dad', family: 'F2', count: 2 }]);
        const rooms  = makeRooms([{ capacity: 2, count: 3 }, { capacity: 4, count: 1 }]);
        const r1 = allocate(guests, rooms);
        guests[2].confirmed = false; guests[3].confirmed = false;
        const r2 = allocate(guests, rooms);
        assert(roomsUsed(r2) <= roomsUsed(r1), 'Fewer or equal rooms after cancellation');
        assert(r2.placed.flatMap(e => e.guests).length === 2, '2 confirmed placed');
      },
    },
    {
      id: 'EC-06', category: 'Edge Cases', name: 'Large scale — 30 guests across all 6 sides',
      run() {
        const guests = makeGuests([
          { side: 'bride_dad',     family: 'DF1',  count: 4 },
          { side: 'bride_dad',     family: 'DF2',  count: 2 },
          { side: 'bride_mom',     family: 'MF1',  count: 2 },
          { side: 'bride_mom',     family: 'MF2',  count: 2 },
          { side: 'groom_dad',     family: 'GF1',  count: 3 },
          { side: 'groom_dad',     family: 'GF2',  count: 2 },
          { side: 'groom_mom',     family: 'GM1',  count: 3 },
          { side: 'groom_mom',     family: 'GM2',  count: 2 },
          { side: 'bride_friends', family: 'BF1',  count: 3 },
          { side: 'bride_friends', family: 'BF2',  count: 2 },
          { side: 'groom_friends', family: 'GrF1', count: 3 },
          { side: 'groom_friends', family: 'GrF2', count: 2 },
        ]);
        const rooms = makeRooms([{ capacity: 3, count: 4 }, { capacity: 4, count: 4 }, { capacity: 3, count: 4 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), 'No mixing'); assert(allPlaced(result), 'All 30 placed');
        assert(capacityRespected(result), 'Capacity respected');
      },
    },
    {
      id: 'EC-07', category: 'Edge Cases', name: "Families from different sides don't share rooms even when sizes match",
      run() {
        const guests = makeGuests([{ side: 'bride_dad', family: 'DF', count: 2 }, { side: 'bride_mom', family: 'MF', count: 2 }]);
        const rooms  = makeRooms([{ capacity: 4 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), 'Must not mix');
      },
    },
    {
      id: 'EC-08', category: 'Edge Cases', name: "Bride's Friends and Groom's Friends are separate sides",
      run() {
        const guests = makeGuests([{ side: 'bride_friends', family: 'BF', count: 2 }, { side: 'groom_friends', family: 'GrF', count: 2 }]);
        const rooms  = makeRooms([{ capacity: 4 }]);
        const result = allocate(guests, rooms);
        assert(noSideMixing(result), "Friend groups must not share a room");
      },
    },
  ];
}

// ── Runner UI ─────────────────────────────────────────────────────────────────
const CAT_COLORS = {
  Algorithm:      ['#e8f5e9', '#2e7d32', '#43a047'],
  Pairs:          ['#e8eaf6', '#283593', '#3949ab'],
  'Side Isolation': ['#e0f2f1', '#00695c', '#00897b'],
  'Edge Cases':   ['#f3e5f5', '#6a1b9a', '#8e24aa'],
};

export default function TestRunner() {
  const [results,   setResults]   = useState({});
  const [running,   setRunning]   = useState(false);
  const [expanded,  setExpanded]  = useState({});
  const [activeTab, setActiveTab] = useState('All');

  const tests = buildTests();

  async function runAll() {
    setRunning(true);
    setResults({});
    const next = {};
    for (const t of tests) {
      resetIds();
      try { t.run(); next[t.id] = { ok: true }; }
      catch (e) { next[t.id] = { ok: false, error: e.message }; }
      setResults({ ...next });
      await new Promise(r => setTimeout(r, 10)); // yield to re-render
    }
    setRunning(false);
  }

  async function runCategory(cat) {
    setRunning(true);
    const next = { ...results };
    for (const t of tests.filter(t => t.category === cat)) {
      resetIds();
      try { t.run(); next[t.id] = { ok: true }; }
      catch (e) { next[t.id] = { ok: false, error: e.message }; }
      setResults({ ...next });
      await new Promise(r => setTimeout(r, 10));
    }
    setRunning(false);
  }

  const categories = [...new Set(tests.map(t => t.category))];
  const ran    = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r.ok).length;
  const failed = ran - passed;

  const displayTests = activeTab === 'All' ? tests
    : activeTab === '❌ Failed' ? tests.filter(t => results[t.id] && !results[t.id].ok)
    : tests.filter(t => t.category === activeTab);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'Georgia,serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#283593,#6a1b9a)', padding: '18px 20px', color: '#fff' }}>
        <div style={{ fontSize: 20, fontWeight: 'bold' }}>🧪 Test Runner</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>31 algorithm tests · InnVite</div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: 16 }}>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={runAll} disabled={running}
            style={{ background: '#283593', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontFamily: 'Georgia,serif', cursor: 'pointer', fontSize: 13 }}>
            {running ? '⏳ Running…' : '▶ Run All'}
          </button>
          {categories.map(cat => {
            const [bg, , color] = CAT_COLORS[cat] || ['#eee', '#333', '#333'];
            return (
              <button key={cat} onClick={() => runCategory(cat)} disabled={running}
                style={{ background: bg, color, border: 'none', borderRadius: 7, padding: '8px 14px', fontFamily: 'Georgia,serif', cursor: 'pointer', fontSize: 12 }}>
                ▶ {cat}
              </button>
            );
          })}
        </div>

        {/* Summary */}
        {ran > 0 && (
          <div style={{ background: failed === 0 ? '#e8f5e9' : '#fff3e0', borderRadius: 9, padding: '10px 16px', marginBottom: 14, display: 'flex', gap: 20 }}>
            <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ {passed} passed</span>
            {failed > 0 && <span style={{ color: '#e65100', fontWeight: 'bold' }}>❌ {failed} failed</span>}
            <span style={{ color: '#aaa' }}>{ran}/{tests.length} run</span>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {['All', ...categories, '❌ Failed'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{
                border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 11,
                fontFamily: 'Georgia,serif', cursor: 'pointer',
                background: activeTab === t ? '#283593' : '#e8eaf6',
                color: activeTab === t ? '#fff' : '#283593',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Test list */}
        {displayTests.map(t => {
          const res = results[t.id];
          const [bg, dark] = CAT_COLORS[t.category] || ['#f5f5f5', '#333'];
          const isExp = expanded[t.id];
          return (
            <div key={t.id} style={{
              background: '#fff', borderRadius: 9, marginBottom: 8,
              border: `1.5px solid ${res ? (res.ok ? '#a5d6a7' : '#ffcc80') : '#eee'}`,
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setExpanded(e => ({ ...e, [t.id]: !e[t.id] }))}
                style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 10 }}>
                <span style={{ background: bg, color: dark, fontSize: 10, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>
                  {t.category}
                </span>
                <span style={{ fontWeight: 'bold', fontSize: 11, color: '#888', width: 50, flexShrink: 0 }}>{t.id}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{t.name}</span>
                {res && <span style={{ fontSize: 16, flexShrink: 0 }}>{res.ok ? '✅' : '❌'}</span>}
                {!res && running && <span style={{ fontSize: 12, color: '#bbb' }}>…</span>}
              </div>
              {isExp && res && !res.ok && (
                <div style={{ padding: '8px 14px 12px', background: '#fff8f0', fontSize: 12, color: '#c62828', borderTop: '1px solid #ffe0b2' }}>
                  {res.error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
