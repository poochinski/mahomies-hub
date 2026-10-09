// Small inline icons so the app has no icon-library dependency.
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};

export const HomeIcon = () => (
  <svg {...base}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
);
export const LeagueIcon = () => (
  <svg {...base}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 6h3v2a3 3 0 0 1-3 3" /><path d="M7 6H4v2a3 3 0 0 0 3 3" /></svg>
);
export const RecordsIcon = () => (
  <svg {...base}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></svg>
);
export const BookIcon = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></svg>
);
export const MeIcon = () => (
  <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);

export const HubMark = ({ size = 34 }) => (
  <img src="/favicon.svg" width={size} height={size} alt="" className="hub-mark" />
);
