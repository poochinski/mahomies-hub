// Layout shell + routes only. Each page lives in src/pages/.
import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import { BananaMark, BookIcon, HomeIcon, LeagueIcon, MeIcon, RecordsIcon } from './components/Icons.jsx';

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/history', label: 'League', icon: LeagueIcon },
  { to: '/records', label: 'Records', icon: RecordsIcon },
  { to: '/book', label: 'Book', icon: BookIcon },
  { to: '/me', label: 'Me', icon: MeIcon }
];

function Brand() {
  return (
    <div className="brand">
      <BananaMark size={40} />
      <div>
        <div className="brand-name">
          MAHOMIE'S <strong>HUB</strong>
        </div>
        <div className="brand-subtitle">LEAGUE HQ · HISTORY + STATS + SPORTSBOOK</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      {/* Desktop sidebar (hidden on phones) */}
      <aside className="sidebar">
        <Brand />
        <div className="nav-label">MENU</div>
        <nav className="side-nav">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="side-link">
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="dots"><i className="d-b" /><i className="d-g" /><i className="d-r" /><i className="d-y" /></div>
          <p>Peel back the league.</p>
        </div>
      </aside>

      <div className="site">
        {/* Phone top bar */}
        <header className="topbar">
          <Brand />
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<ComingSoon title="League History" phase={2} blurb="Every season since 2023: champions, Sackos, all-time standings and trophy cases." />} />
            <Route path="/records" element={<ComingSoon title="Record Book" phase={2} blurb="Highs, lows, blowouts and best player games, updated every week." />} />
            <Route path="/book" element={<ComingSoon title="The Banana Book" phase={4} blurb="Moneyline, spread and over/under on every matchup, bet with Banana Bucks." />} />
            <Route path="/me" element={<ComingSoon title="My Team" phase={2} blurb="Your career stats, trophy case, bets and bankroll." />} />
            <Route path="*" element={<ComingSoon title="Page not found" blurb="That page doesn't exist. Use the tabs to get back." />} />
          </Routes>
        </main>
      </div>

      {/* Phone bottom tab bar */}
      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
