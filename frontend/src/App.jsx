import { useState, useEffect } from 'react';
import { Clock, Calendar, RefreshCw, Utensils, Mail } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';

// Items that are just condiments/garnishes -- not worth showing
const BORING_ITEMS = new Set([
    'lettuce leaf', 'sliced tomatoes', 'dill pickle slices', 'sliced red onion',
    'carved entree', 'sour cream', 'shredded cheddar cheese', 'mild picante salsa',
    'ketchup', 'mustard', 'mayonnaise', 'hot sauce', 'yellow mustard',
    'sweet thai chili sauce', 'sriracha', 'soy sauce', 'hoisin sauce',
    'ranch dressing', 'blue cheese dressing', 'italian dressing',
    'butter', 'margarine', 'cream cheese', 'jelly',
    'salt', 'pepper', 'lemon wedge', 'tartar sauce',
    'crackers, saltine, 2 ct, zesta', 'crushed red pepper', 'dried oregano',
    'grated parmesan cheese', 'whole grain mustard',
    'sliced jalapeno', 'chopped spinach', 'chopped tomatoes', ' diced onions',
    'sliced mushrooms', 'chopped green bell pepper', 'shredded sharp cheddar cheese',
    'diced smoked ham', 'diced turkey breast', 'chicken sausage patty',
    'pork bacon', 'chipotle salsa', 'eggs', 'egg whites',
    'gluten free soy sauce', 'mr. bing chili crisp mild', 'sesame oil',
    'chopped green onions', 'garlic ginger aromatics',
    'julienne yellow onions', 'shredded green cabbage',
    'red and green bell peppers', 'shredded carrots',
    'fresh cilantro', '6" flour tortilla', 'pico de gallo',
    'guacamole', 'salsa verde',
    'white pita bread', 'dinner roll', 'bread sticks',
]);

function isBoring(name) {
    return BORING_ITEMS.has(name.trim().toLowerCase());
}

// Title-case food names that come in all-lowercase from the API
function titleCase(str) {
    const small = new Set(['and', 'with', 'of', 'in', 'on', 'a', 'the', 'or', 'for']);
    return str.replace(/\w\S*/g, (word, i) => {
        if (i > 0 && small.has(word.toLowerCase())) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

function formatName(name) {
    // If the name is all lowercase or all uppercase, fix it
    if (name === name.toLowerCase() || name === name.toUpperCase()) {
        return titleCase(name);
    }
    return name;
}

// Shorten ugly station names from the API
const STATION_RENAMES = {
    'cultural crossroads-performance circle': 'Cultural Crossroads',
    'the soup bowl': 'Soup',
    'heart of the house': 'Entrees',
    'united table': 'Stir-Fry Bar',
    'mason manor': 'Entrees',
    'patriot pit': 'Grill',
    'rooted patriot pit': null, // hide empty rooted stations
};

function cleanStationName(name) {
    const lower = name.toLowerCase().trim();
    if (lower in STATION_RENAMES) return STATION_RENAMES[lower];
    return name;
}

// Format date nicely
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Easter eggs & contextual messages ───────────────────────
const LATE_NIGHT_MESSAGES = [
    "The dining halls are sleeping. You should be too.",
    "Nothing's open. Microwave ramen it is.",
    "Southside closed 3 hours ago. Tragic.",
    "The only thing open right now is your fridge.",
    "Fun fact: Ike's ice cream machine is probably broken anyway.",
    "You're up late. The dining halls are not.",
    "Closed. Maybe check if Taco Bell on 123 is still open.",
];

const DEEP_NIGHT_MESSAGES = [
    "It's past 2am. Go to sleep.",
    "No food. Only regret at this hour.",
    "The vending machines in the JC are your only hope.",
    "Sir/ma'am this is a dining hall app. At 3am.",
    "Even the raccoons on campus have gone to bed.",
    "Tomorrow's menu is up in a few hours. Just wait.",
    "You know what pairs well with 3am? Sleep.",
];

const WEEKEND_MORNING = [
    "Weekend brunch doesn't start until 11. Go back to sleep.",
    "Nothing's open yet. It's the weekend.",
];

// GMU 2025-2026 academic calendar approximate dates
function getSpecialEvent(now) {
    const m = now.getMonth(); // 0-indexed
    const d = now.getDate();
    const day = now.getDay(); // 0=Sun

    // Winter break (mid Dec - mid Jan)
    if ((m === 11 && d >= 14) || (m === 0 && d <= 12))
        return { msg: "School's out. Dining halls are closed for winter break.", type: 'break' };

    // Spring break (mid March, roughly)
    if (m === 2 && d >= 9 && d <= 16)
        return { msg: "It's spring break. Go touch grass.", type: 'break' };

    // Summer break (mid May - late Aug)
    if ((m === 4 && d >= 10) || (m >= 5 && m <= 6) || (m === 7 && d <= 20))
        return { msg: "It's summer. The dining halls miss you. (They're closed.)", type: 'break' };

    // Thanksgiving break (4th week of Nov)
    if (m === 10 && d >= 23 && d <= 30)
        return { msg: "Happy Thanksgiving. Hope you're not on campus.", type: 'break' };

    // Finals week (first 2 weeks of Dec, last week of April)
    if ((m === 11 && d >= 1 && d <= 13) || (m === 3 && d >= 25))
        return { msg: "Finals week. You got this. Eat something.", type: 'finals' };

    // Last week of classes (late April)
    if (m === 3 && d >= 21 && d <= 24)
        return { msg: "Last week of classes. Almost there.", type: 'finals' };

    return null;
}

function getVibeMessage() {
    const now = new Date();
    const h = now.getHours();
    const day = now.getDay();

    // Check special events first
    const special = getSpecialEvent(now);
    if (special?.type === 'break') return { text: special.msg, type: 'break' };

    // Deep night: 2am - 5am
    if (h >= 2 && h < 5) {
        const msg = DEEP_NIGHT_MESSAGES[Math.floor(Math.random() * DEEP_NIGHT_MESSAGES.length)];
        return { text: msg, type: 'night' };
    }

    // Late night: 10pm - 2am
    if (h >= 22 || h < 2) {
        const msg = LATE_NIGHT_MESSAGES[Math.floor(Math.random() * LATE_NIGHT_MESSAGES.length)];
        return { text: msg, type: 'night' };
    }

    // Weekend before 11am
    if ((day === 0 || day === 6) && h < 11) {
        const msg = WEEKEND_MORNING[Math.floor(Math.random() * WEEKEND_MORNING.length)];
        return { text: msg, type: 'weekend' };
    }

    // Finals week message
    if (special?.type === 'finals') return { text: special.msg, type: 'finals' };

    return null;
}

// Get calories from nutrients array
function getCalories(item) {
    if (item.calories && item.calories > 0) return item.calories;
    const cal = (item.nutrients || []).find(n => n.name === 'Calories');
    const val = cal ? Number(cal.value || cal.valueNumeric) : 0;
    return val > 0 ? val : null;
}

// Get protein from nutrients array
function getProtein(item) {
    const prot = (item.nutrients || []).find(n => n.name === 'Protein (g)');
    const val = prot ? Number(prot.value || prot.valueNumeric) : 0;
    return val > 0 ? Math.round(val) : null;
}

// ── Mail Preferences Panel ──────────────────────────────────
function MailPreferences({ apiBase }) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState(null); // null | 'loading' | 'subscribed' | 'unsubscribed' | 'error'
    const [msg, setMsg] = useState('');

    const doAction = async (action) => {
        if (!email.trim()) return;
        setStatus('loading');
        try {
            const url = action === 'subscribe'
                ? `${apiBase}/api/mailing-list`
                : `${apiBase}/api/mailing-list/${encodeURIComponent(email.trim())}`;
            const res = await fetch(url, {
                method: action === 'subscribe' ? 'POST' : 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: action === 'subscribe' ? JSON.stringify({ email: email.trim() }) : undefined,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed');
            setStatus(action === 'subscribe' ? 'subscribed' : 'unsubscribed');
            setMsg(action === 'subscribe' ? "You're on the list. We'll send you daily menus." : "Unsubscribed. You won't get any more emails.");
            setEmail('');
            setTimeout(() => { setStatus(null); setOpen(false); }, 3000);
        } catch (err) {
            setStatus('error');
            setMsg(err.message);
            setTimeout(() => setStatus(null), 3000);
        }
    };

    return (
        <>
            <button className="mail-icon-btn" onClick={() => setOpen(true)} title="Email notifications">
                <Mail size={18} />
            </button>
            {open && (
                <div className="mail-overlay" onClick={() => { setOpen(false); setStatus(null); }}>
                    <div className="mail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="mail-modal-header">
                            <span className="mail-modal-title">Daily menu emails</span>
                            <button className="mail-modal-close" onClick={() => { setOpen(false); setStatus(null); }}>&times;</button>
                        </div>
                        <p className="mail-modal-desc">Get today's menu sent to your inbox every morning.</p>
                        {status === 'subscribed' || status === 'unsubscribed' ? (
                            <p className={`mail-result ${status === 'subscribed' ? 'mail-result--ok' : ''}`}>{msg}</p>
                        ) : (
                            <>
                                <input
                                    type="email"
                                    className="mail-input"
                                    placeholder="yourname@gmu.edu"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={status === 'loading'}
                                    autoFocus
                                />
                                <div className="mail-actions">
                                    <button
                                        className="mail-action mail-action--sub"
                                        onClick={() => doAction('subscribe')}
                                        disabled={status === 'loading' || !email.trim()}
                                    >
                                        Subscribe
                                    </button>
                                    <button
                                        className="mail-action mail-action--unsub"
                                        onClick={() => doAction('unsubscribe')}
                                        disabled={status === 'loading' || !email.trim()}
                                    >
                                        Unsubscribe
                                    </button>
                                </div>
                                {status === 'error' && <p className="mail-error">{msg}</p>}
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// ── Meal Status ──────────────────────────────────────────────
function MealStatus() {
    const [info, setInfo] = useState(getMealInfo);

    useEffect(() => {
        const id = setInterval(() => setInfo(getMealInfo()), 30_000);
        return () => clearInterval(id);
    }, []);

    return (
        <span className={`meal-status meal-status--${info.status}`}>
            {info.label}
        </span>
    );
}

function getMealInfo() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const t = h * 60 + m; // minutes since midnight

    // GMU dining hours (approx):
    // Breakfast: 7:00 - 10:30
    // Lunch: 11:00 - 17:00 (5pm)
    // Dinner: 17:00 - 22:00 (10pm)
    // Late Night (Ike's only): 22:00 - 01:00

    if (t < 420) { // before 7am
        const mins = 420 - t;
        return { label: `Breakfast opens in ${Math.floor(mins / 60)}h ${mins % 60}m`, status: 'upcoming', period: 'Lunch' };
    } else if (t < 630) { // 7am - 10:30am
        const mins = 630 - t;
        return { label: `Breakfast until ${mins > 60 ? Math.floor(mins / 60) + 'h ' : ''}${mins % 60}m`, status: 'active', period: 'Lunch' };
    } else if (t < 660) { // 10:30 - 11am
        const mins = 660 - t;
        return { label: `Lunch opens in ${mins}m`, status: 'upcoming', period: 'Lunch' };
    } else if (t < 1020) { // 11am - 5pm
        const mins = 1020 - t;
        return { label: `Lunch until ${Math.floor(mins / 60)}h ${mins % 60}m`, status: 'active', period: 'Lunch' };
    } else if (t < 1320) { // 5pm - 10pm
        const mins = 1320 - t;
        return { label: `Dinner until ${Math.floor(mins / 60)}h ${mins % 60}m`, status: 'active', period: 'Dinner' };
    }
    return { label: 'Dining halls closed', status: 'closed', period: null };
}

function getCurrentPeriod() {
    const h = new Date().getHours();
    if (h < 17) return 'Lunch';   // show lunch until 5pm
    return 'Dinner';
}

// ── Food Item Row ────────────────────────────────────────────
function FoodItem({ item }) {
    const cal = getCalories(item);
    const protein = getProtein(item);

    return (
        <div className="food-row">
            <span className="food-name">{formatName(item.name)}</span>
            <span className="food-meta">
                {protein && <span className="food-protein">{protein}g</span>}
                {cal && <span className="food-cal">{cal}</span>}
            </span>
        </div>
    );
}

// ── Konami Code Hook ────────────────────────────────────────
function useKonami(callback) {
    useEffect(() => {
        const code = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // up up down down left right left right b a
        let pos = 0;
        const handler = (e) => {
            if (e.keyCode === code[pos]) {
                pos++;
                if (pos === code.length) { callback(); pos = 0; }
            } else { pos = 0; }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [callback]);
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
    const [menuData, setMenuData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showAllPeriods, setShowAllPeriods] = useState(false);
    const [logoClicks, setLogoClicks] = useState(0);
    const [konamiActive, setKonamiActive] = useState(false);
    const [vibe] = useState(() => getVibeMessage());

    useKonami(() => setKonamiActive(k => !k));

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
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => { loadMenus(); }, []);

    const activePeriod = getCurrentPeriod();

    // Build a compact view: for each hall, show only the active period's items
    const renderHallCard = (hallName, periods, index) => {
        // Decide which periods to show
        const periodsToShow = showAllPeriods
            ? Object.keys(periods).sort((a, b) => (a === 'Lunch' ? -1 : 1))
            : [activePeriod];

        const hasAnyData = periodsToShow.some(p => (periods[p] || []).length > 0);

        // Fallback: if the active period has no data, show whatever is available
        let fallbackPeriod = null;
        if (!hasAnyData && !showAllPeriods) {
            fallbackPeriod = Object.keys(periods).find(p => (periods[p] || []).length > 0);
        }

        const finalPeriods = fallbackPeriod ? [fallbackPeriod] : periodsToShow;

        // Count total real items for this card
        const totalItems = finalPeriods.reduce((acc, p) => {
            return acc + (periods[p] || []).reduce((sum, station) =>
                sum + (station.items || []).filter(i => !isBoring(i.name)).length, 0);
        }, 0);

        return (
            <div key={hallName} className="hall-card">
                <div className="hall-header">
                    <h3 className="hall-name">{hallName}</h3>
                </div>

                {finalPeriods.map(periodName => {
                    const stations = periods[periodName] || [];
                    if (!stations.length) return null;

                    return (
                        <div key={periodName} className="period-block">
                            {(showAllPeriods || fallbackPeriod) && (
                                <div className="period-label">
                                    <Clock size={11} />
                                    <span>{periodName}</span>
                                </div>
                            )}
                            {stations.map(station => {
                                const stationName = cleanStationName(station.name);
                                if (stationName === null) return null;
                                const items = (station.items || []).filter(i => !isBoring(i.name));
                                if (!items.length) return null;

                                return (
                                    <div key={station.name} className="station">
                                        <div className="station-label">{stationName}</div>
                                        <div className="station-items">
                                            {items.map(item => (
                                                <FoodItem key={item.name} item={item} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {totalItems === 0 && (
                    <p className="empty-msg">No menu posted yet.</p>
                )}
            </div>
        );
    };

    return (
        <div className="app">
            <header className="header">
                <div className="header-left">
                    <h1 className="logo" onClick={() => setLogoClicks(c => c + 1)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <Utensils size={22} className={`logo-icon${konamiActive ? ' logo-spin' : ''}`} />
                        <span>{konamiActive ? 'GMU Dining (god mode)' : logoClicks >= 10 ? 'GMU Dining (you found nothing)' : logoClicks >= 5 ? 'stop clicking me' : 'GMU Dining'}</span>
                    </h1>
                    <MealStatus />
                </div>
                <MailPreferences apiBase={API_BASE} />
            </header>

            <main className={`main${konamiActive ? ' konami' : ''}`}>
                {vibe && (
                    <div className={`vibe-banner vibe-banner--${vibe.type}`}>
                        {vibe.text}
                    </div>
                )}
                {loading ? (
                    <div className="loading">
                        <div className="spinner" />
                        <p>Loading today's menus...</p>
                    </div>
                ) : error ? (
                    <div className="error-card">
                        <p className="error-text">Could not load menus</p>
                        <p className="error-detail">{error}</p>
                        <button className="btn btn--primary" onClick={() => loadMenus()}>
                            <RefreshCw size={14} /> Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="toolbar">
                            <div className="toolbar-left">
                                <Calendar size={14} />
                                <span className="toolbar-date">{formatDate(menuData?.date)}</span>
                                <button
                                    className="btn-icon"
                                    onClick={() => loadMenus(true)}
                                    disabled={refreshing}
                                    title="Refresh"
                                >
                                    <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
                                </button>
                            </div>
                            <div className="toolbar-right">
                                <button
                                    className={`period-toggle${showAllPeriods ? ' period-toggle--active' : ''}`}
                                    onClick={() => setShowAllPeriods(!showAllPeriods)}
                                >
                                    {showAllPeriods ? 'All meals' : activePeriod + ' only'}
                                </button>
                            </div>
                        </div>

                        <div className="hall-grid">
                            {Object.entries(menuData?.menus ?? {}).map(([hall, periods], i) =>
                                renderHallCard(hall, periods, i)
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
