import { useState, useEffect, useRef } from 'react';
import { ChefHat, MapPin, Clock, Calendar, RefreshCw, Utensils, Mail, Shuffle, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';

// ── Inline Subscribe Bar ──────────────────────────────────────────
function SubscribeBar({ apiBase }) {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setStatus('loading');
        try {
            const res = await fetch(`${apiBase}/api/subscribers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed');
            setStatus('ok');
            setMsg('You\'re on the list! 🎉');
            setEmail('');
            setTimeout(() => setStatus(null), 4000);
        } catch (err) {
            setStatus('error');
            setMsg(err.message);
            setTimeout(() => setStatus(null), 4000);
        }
    };

    if (status === 'ok') {
        return (
            <div className="subscribe-success" role="status">
                <CheckCircle size={14} />
                <span>{msg}</span>
            </div>
        );
    }

    return (
        <form className="subscribe-bar" onSubmit={handleSubmit} aria-label="Join daily digest mailing list">
            <Mail size={14} className="subscribe-icon" />
            <input
                type="email"
                className="subscribe-input"
                placeholder="yourname@gmu.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
                aria-label="Email address"
                required
            />
            <button
                type="submit"
                className="subscribe-btn"
                disabled={status === 'loading'}
            >
                {status === 'loading' ? '…' : 'Join'}
            </button>
            {status === 'error' && (
                <span className="subscribe-error">{msg}</span>
            )}
        </form>
    );
}

// ── Meal Countdown ────────────────────────────────────────────────
function MealCountdown() {
    const getInfo = () => {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();

        // Lunch: 11:00 – 17:00  |  Dinner: 17:00 – 21:00
        if (h < 11) {
            const minsLeft = (11 - h - 1) * 60 + (60 - m);
            return { label: `Lunch opens in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`, period: 'soon' };
        } else if (h < 17) {
            const minsLeft = (17 - h - 1) * 60 + (60 - m);
            return { label: `Lunch · closes in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`, period: 'lunch' };
        } else if (h < 21) {
            const minsLeft = (21 - h - 1) * 60 + (60 - m);
            return { label: `Dinner · closes in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`, period: 'dinner' };
        } else {
            return { label: 'Dining halls closed — see you tomorrow!', period: 'closed' };
        }
    };

    const [info, setInfo] = useState(getInfo);

    useEffect(() => {
        const id = setInterval(() => setInfo(getInfo()), 30_000);
        return () => clearInterval(id);
    }, []);

    const colors = { lunch: 'var(--accent)', dinner: 'var(--gold)', soon: 'var(--text-secondary)', closed: 'var(--red)' };

    return (
        <div className="meal-countdown" style={{ color: colors[info.period] ?? 'var(--text-secondary)' }}>
            <Clock size={12} />
            <span>{info.label}</span>
        </div>
    );
}

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
    const [menuData, setMenuData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [luckyHall, setLuckyHall] = useState(null);
    const [luckySpinning, setLuckySpinning] = useState(false);

    const loadMenus = (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else { setLoading(true); setError(null); }

        fetch(`${API_BASE}/api/menus`)
            .then((res) => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(setMenuData)
            .catch((err) => setError(err.message))
            .finally(() => {
                setLoading(false);
                setRefreshing(false);
            });
    };

    useEffect(() => { loadMenus(); }, []);

    // ── Lucky Dip ──────────────────────────────────────────────────
    const handleLuckyDip = () => {
        if (!menuData?.menus || luckySpinning) return;
        setLuckySpinning(true);
        setLuckyHall(null);

        // "Spinning" suspense — cycle through halls rapidly then settle
        const halls = Object.keys(menuData.menus);
        let count = 0;
        const max = 10;
        const id = setInterval(() => {
            setLuckyHall(halls[count % halls.length]);
            count++;
            if (count >= max) {
                clearInterval(id);
                const winner = halls[Math.floor(Math.random() * halls.length)];
                setLuckyHall(winner);
                setLuckySpinning(false);
            }
        }, 80);
    };

    const recommendedHall = menuData?.recommendation?.hall;

    // ── Summary Banner ────────────────────────────────────────────
    const getCurrentPeriod = () => {
        const h = new Date().getHours();
        return h < 17 ? 'Lunch' : 'Dinner';
    };

    const buildSummaryItems = () => {
        if (!menuData?.menus) return [];
        const period = getCurrentPeriod();
        const backendHighlights = menuData.recommendation?.highlight_dishes ?? {};
        const items = [];

        for (const [hall, periods] of Object.entries(menuData.menus)) {
            let topDish = null;
            if (backendHighlights[hall]?.length > 0) {
                topDish = backendHighlights[hall][0];
            } else {
                const cats = periods[period] ?? Object.values(periods).find(c => c?.length) ?? [];
                for (const cat of cats) {
                    const first = cat.items?.find(i => i.name?.trim());
                    if (first) { topDish = first.name.trim(); break; }
                }
            }
            items.push({ hall, dish: topDish, isRec: hall === recommendedHall });
        }
        return items;
    };

    const renderSummaryBanner = () => {
        if (!menuData?.menus) return null;
        const period = getCurrentPeriod();
        const items = buildSummaryItems();
        const recItem = items.find(i => i.isRec);

        return (
            <div className="summary-banner animate-delay-1">
                <div className="summary-period">
                    <Utensils size={13} />
                    <span>{period === 'Lunch' ? 'Lunch (until 5 PM)' : 'Dinner'} — right now</span>
                    <MealCountdown />
                </div>
                <div className="summary-halls">
                    {items.map(({ hall, dish }) => (
                        <div key={hall} className="summary-hall-item">
                            <span className="summary-hall-name">{hall}</span>
                            {dish && <span className="summary-hall-dish">{dish}</span>}
                        </div>
                    ))}
                </div>
                {recItem && (
                    <div className="summary-rec">
                        <span className="summary-rec-label">The Move Today →</span>
                        <span>
                            {recItem.hall}{recItem.dish ? ` is serving ${recItem.dish}` : ''}
                            {menuData.recommendation?.reason
                                ? ` — ${menuData.recommendation.reason}`
                                : '. Head there.'}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    // ── Render helpers ────────────────────────────────────────────
    const renderStation = (station, index) => {
        if (!station.items?.length) return null;
        return (
            <div key={station.name} className={`station-item animate-delay-${(index % 3) + 1}`}>
                <div className="station-name">{station.name}</div>
                <ul className="food-items">
                    {station.items.map((item) => (
                        <li key={item.name} className="food-item">{item.name}</li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderLocation = (name, periods, index) => {
        const isRecommended = name === recommendedHall;
        const isLucky = name === luckyHall && !luckySpinning;
        const hasData = Object.values(periods).some((cats) => cats.length > 0);

        // Hype score: count items, cap at 12 for 100%
        const totalItems = Object.values(periods).flatMap(c => c).reduce((acc, cat) => acc + (cat.items?.length ?? 0), 0);
        const hype = Math.min(totalItems / 12, 1);

        return (
            <div
                key={name}
                className={`glass-panel animate-delay-${index + 1}${isRecommended ? ' recommended-card' : ''}${isLucky ? ' lucky-card' : ''}`}
            >
                <div className="location-header">
                    <div className={`location-icon${isRecommended ? ' recommended-icon' : ''}${isLucky ? ' lucky-icon' : ''}`}>
                        <MapPin size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3>{name}</h3>
                        {isRecommended && (
                            <div className="recommended-badge">
                                <span>The Move Today</span>
                            </div>
                        )}
                        {isLucky && !isRecommended && (
                            <div className="lucky-badge">
                                <span>🎲 Lucky Dip Pick!</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Hype meter */}
                <div className="hype-meter" title={`${totalItems} items on the menu`}>
                    <div className="hype-bar" style={{ width: `${hype * 100}%` }} />
                    <span className="hype-label">
                        {hype > 0.8 ? '🔥 Packed' : hype > 0.5 ? '✨ Good spread' : '🧘 Chill vibes'}
                    </span>
                </div>

                {isRecommended && menuData?.recommendation?.reason && (
                    <div className="recommendation-reason">
                        <p>{menuData.recommendation.reason}</p>
                    </div>
                )}

                {!hasData ? (
                    <div className="empty-state">
                        <ChefHat size={36} style={{ opacity: 0.35 }} />
                        <p>No highlights available today.</p>
                    </div>
                ) : (
                    Object.entries(periods)
                        .sort(([a], [b]) => {
                            const order = { Lunch: 0, Dinner: 1 };
                            return (order[a] ?? 99) - (order[b] ?? 99);
                        })
                        .map(([periodName, categories]) => {
                            // Filter out "Rooted Patriot Pit" explicitly on the frontend
                            const filteredCategories = categories.filter(
                                cat => !cat.name?.toLowerCase().includes('patriot pit')
                            );

                            if (!filteredCategories.length) return null;

                            return (
                                <div key={periodName} className="period-section">
                                    <div className="period-title">
                                        <Clock size={13} />
                                        <span>{periodName}</span>
                                    </div>
                                    <div>{filteredCategories.map((cat, i) => renderStation(cat, i))}</div>
                                </div>
                            );
                        })
                )}
            </div>
        );
    };

    return (
        <div className="container">
            <header>
                <div>
                    <h1 className="title">Fuel Your Performance</h1>
                    <p className="subtitle">GMU Patriot Dining Tracker</p>
                </div>
                <div className="header-right">
                    <SubscribeBar apiBase={API_BASE} />
                </div>
            </header>

            <main>
                {loading ? (
                    <div className="loader-container" aria-label="Loading menus">
                        <div className="spinner" />
                        <h2>Fetching today's highlights…</h2>
                    </div>
                ) : error ? (
                    <div className="glass-panel empty-state">
                        <ChefHat size={40} style={{ opacity: 0.35 }} />
                        <p style={{ color: 'var(--red)' }}>Could not load menus</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{error}</p>
                        <button className="primary" onClick={() => loadMenus()}>
                            <RefreshCw size={15} /> Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="menu-meta">
                            <Calendar size={16} />
                            <span>Highlights — {menuData?.date}</span>
                            <button
                                onClick={() => loadMenus(true)}
                                disabled={refreshing}
                                title="Refresh menus"
                                aria-label="Refresh menus"
                                style={{
                                    background: 'none', border: 'none', cursor: refreshing ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                                    padding: '0.1rem', opacity: refreshing ? 0.5 : 1,
                                    transition: 'color 0.2s', marginLeft: '0.25rem',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                            >
                                <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
                            </button>

                            {/* Lucky Dip */}
                            <button
                                className={`lucky-dip-btn${luckySpinning ? ' spinning' : ''}`}
                                onClick={handleLuckyDip}
                                disabled={luckySpinning}
                                title="Can't decide? Let fate choose!"
                                aria-label="Lucky Dip — pick a random dining hall"
                            >
                                <Shuffle size={13} />
                                <span>{luckySpinning ? luckyHall ?? '…' : '🎲 Lucky Dip'}</span>
                            </button>
                        </div>

                        {renderSummaryBanner()}

                        <div className="grid">
                            {Object.entries(menuData?.menus ?? {}).map(([loc, periods], i) =>
                                renderLocation(loc, periods, i)
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
