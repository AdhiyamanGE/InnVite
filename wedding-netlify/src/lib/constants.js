// ─── ─── Sides ─── ────────────────────────────────────────────────────────────
export const SIDES = [
  { id: 'bride_dad',     label: "Bride's Dad Side",  color: '#b5838d', bg: '#fce4ec' },
  { id: 'bride_mom',     label: "Bride's Mom Side",  color: '#6d8b74', bg: '#e8f5e9' },
  { id: 'groom_dad',     label: "Groom's Dad Side",  color: '#5c7fa3', bg: '#e3f2fd' },
  { id: 'groom_mom',     label: "Groom's Mom Side",  color: '#7b68a8', bg: '#ede7f6' },
  { id: 'bride_friends', label: "Bride's Friends",   color: '#c07850', bg: '#fff3e0' },
  { id: 'groom_friends', label: "Groom's Friends",   color: '#7a9e7e', bg: '#f1f8e9' },
];

export const SIDE_MAP = Object.fromEntries(SIDES.map(s => [s.id, s]));

export const GENDERS = ['Male', 'Female', 'Other'];

export const FLOORS = ['Ground', '1st', '2nd', '3rd', '4th', '5th'];
