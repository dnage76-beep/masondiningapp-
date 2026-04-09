import { useState, useEffect, useRef, useCallback } from 'react';
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
    "You could DoorDash. Your bank account says otherwise.",
    "Late night Ike's ended hours ago. You missed your window.",
    "The vending machines in the JC don't judge. Go there.",
    "Imagine checking dining hall menus at this hour. Oh wait.",
    "Your future self will thank you for just going to bed.",
    "Nothing here but closed kitchens and bad decisions.",
];

const DEEP_NIGHT_MESSAGES = [
    "It's past 2am. Go to sleep.",
    "No food. Only regret at this hour.",
    "The vending machines in the JC are your only hope.",
    "Sir/ma'am this is a dining hall app. At 3am.",
    "Even the raccoons on campus have gone to bed.",
    "Tomorrow's menu is up in a few hours. Just wait.",
    "You know what pairs well with 3am? Sleep.",
    "Breakfast is in like 4 hours. Hang in there champ.",
    "This app cannot help you right now. Nothing can.",
    "Go drink some water and go to bed.",
    "The dining halls forgot you exist at this hour.",
];

const WEEKEND_MORNING = [
    "Weekend brunch doesn't start until 11. Go back to sleep.",
    "Nothing's open yet. It's the weekend.",
];

// Daytime messages -- random flavor every time you open the app
const DAYTIME_MESSAGES = [
    "Ike's line is probably 20 minutes right now. Just a guess.",
    "Plot twist: it's chicken tenders again.",
    "Southside stir-fry hits different when you're desperate.",
    "You could cook at home. But you won't.",
    "Today's forecast: mid food with a chance of mediocrity.",
    "The Globe is underrated and I will die on this hill.",
    "Reminder: the waffle maker at Ike's has never been cleaned.",
    "POV: you're about to eat the same thing you ate yesterday.",
    "Fun fact: nobody has ever finished a meal at Southside and said 'wow'.",
    "The soup is always there for you. Even when no one else is.",
    "If Ike's Heart of the House is 'carved entree' again I'm transferring.",
    "Dining dollars are just Monopoly money with extra steps.",
    "You didn't come here for a five star meal. Lower those expectations.",
    "Patriot Pit burgers carry this university on their back.",
    "The salad bar exists. You will ignore it. As always.",
    "Somewhere, a Southside worker is refilling the ranch for the 40th time.",
    "This app was made by a guy who got tired of walking to check menus.",
    "Ike's at 12:15 on a Tuesday? Good luck finding a seat.",
    "Hot take: Globe soup is the best item in any dining hall.",
    "You're about to eat. Try to enjoy it. Or at least survive it.",
    "The dining hall doesn't care about your macros. But we do.",
    "Every day I wake up and wonder what Southside will disappoint me with.",
    "Ike's Flips is just a Wendy's that went to college.",
    "You know it's bad when you're excited about the soup.",
    "May your chicken not be dry today. Godspeed.",
    "Broke: eating at Ike's. Woke: eating at the Globe. Bespoke: stealing fruit.",
    "Today's special: whatever was left over from yesterday.",
    "The stir-fry bar is a choose-your-own-adventure with no good endings.",
    "This is your sign to try something new. Or just get chicken tenders.",
    "Bold of you to assume the menu is accurate.",
    "It's giving... dining hall.",
    "Ike's Heart of the House is the main character. Everyone else is a side quest.",
    "If you see 'carved entree' just know that could mean anything.",
    "The dining halls have food. That's the nicest thing I can say.",
    "We scraped this data from the dining website so you don't have to walk there and be disappointed in person.",
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

    // Normal daytime -- always show something funny
    const msg = DAYTIME_MESSAGES[Math.floor(Math.random() * DAYTIME_MESSAGES.length)];
    return { text: msg, type: 'vibe' };
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
                {protein && <span className="food-protein">{protein}g protein</span>}
                {cal && <span className="food-cal">{cal}</span>}
            </span>
        </div>
    );
}

// ── Secret Code Hooks ──────────────────────────────────────
function useSecretCode(sequence, callback) {
    useEffect(() => {
        let pos = 0;
        const handler = (e) => {
            if (e.keyCode === sequence[pos]) {
                pos++;
                if (pos === sequence.length) { callback(); pos = 0; }
            } else { pos = 0; }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [callback, sequence]);
}

const KONAMI = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // up up down down left right left right B A
const FOOD_CODE = [70, 79, 79, 68]; // F O O D

// ── Hacking Terminal ───────────────────────────────────────
const HACK_LINES = [
    { text: '> Initializing GMU Dining Mainframe breach...', delay: 0 },
    { text: '> Connecting to dining.gmu.edu:4433...', delay: 400 },
    { text: '> SSL handshake intercepted', delay: 800 },
    { text: '> Bypassing Sodexo firewall...', delay: 1400 },
    { text: '[################] 100% -- FIREWALL BYPASSED', delay: 2200 },
    { text: '', delay: 2600 },
    { text: '> Accessing /var/dining/classified/...', delay: 2800 },
    { text: '> WARN: Unauthorized access detected', delay: 3200 },
    { text: '> Spoofing MAC address... done', delay: 3600 },
    { text: '> Dumping classified files...', delay: 4200 },
    { text: '', delay: 4600 },
    { text: '=== CLASSIFIED FILE: chicken_tenders_recipe.txt ===', delay: 4800, color: '#eab308' },
    { text: 'INGREDIENTS: Tyson frozen bag, fryer, prayer', delay: 5200, color: '#ccc' },
    { text: '', delay: 5600 },
    { text: '=== CLASSIFIED FILE: health_inspection_2024.pdf ===', delay: 5800, color: '#eab308' },
    { text: 'Southside: "We have concerns"', delay: 6200, color: '#f87171' },
    { text: "Ike's: \"The ice cream machine has never worked\"", delay: 6600, color: '#f87171' },
    { text: 'The Globe: "Actually fine somehow"', delay: 7000, color: '#4ade80' },
    { text: '', delay: 7400 },
    { text: '=== CLASSIFIED FILE: staff_spotify_playlist.csv ===', delay: 7600, color: '#eab308' },
    { text: '1. "Welcome to the Jungle" - Guns N Roses', delay: 8000, color: '#ccc' },
    { text: '2. "Under Pressure" - Queen', delay: 8300, color: '#ccc' },
    { text: '3. "Highway to Hell" - AC/DC', delay: 8600, color: '#ccc' },
    { text: '', delay: 9000 },
    { text: '=== CLASSIFIED FILE: real_food_costs.xlsx ===', delay: 9200, color: '#eab308' },
    { text: 'Dining dollar value: $1.00 = $0.23 actual food', delay: 9600, color: '#f87171' },
    { text: 'Meal swipe cost to GMU: $3.47', delay: 9900, color: '#f87171' },
    { text: 'Meal swipe cost to you: $17.50', delay: 10200, color: '#f87171' },
    { text: '', delay: 10600 },
    { text: '=== CLASSIFIED FILE: renovation_plans_2027.txt ===', delay: 10800, color: '#eab308' },
    { text: 'Southside to be renamed "Sadside" per student vote', delay: 11200, color: '#ccc' },
    { text: "Ike's adding a Chick-fil-A (UNCONFIRMED)", delay: 11600, color: '#4ade80' },
    { text: '', delay: 12000 },
    { text: '> ALERT: Campus police notified', delay: 12200, color: '#f87171' },
    { text: '> Erasing logs...', delay: 12600 },
    { text: '> Closing connection...', delay: 13000 },
    { text: '', delay: 13400 },
    { text: '> Download complete. Returning to dining app.', delay: 13600, color: '#4ade80' },
];

function HackTerminal({ onDone, menuData }) {
    const [lines, setLines] = useState([]);
    const termRef = useRef(null);

    useEffect(() => {
        const timers = HACK_LINES.map((line, i) =>
            setTimeout(() => {
                setLines(prev => [...prev, line]);
                if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
            }, line.delay)
        );

        const exitTimer = setTimeout(() => onDone(), 15000);
        return () => { timers.forEach(clearTimeout); clearTimeout(exitTimer); };
    }, [onDone]);

    // Also allow clicking or pressing any key to exit
    useEffect(() => {
        const skip = (e) => {
            if (lines.length > 10) onDone();
        };
        window.addEventListener('keydown', skip);
        return () => window.removeEventListener('keydown', skip);
    }, [lines.length, onDone]);

    return (
        <div className="hack-overlay" onClick={() => lines.length > 5 && onDone()}>
            <div className="hack-terminal" ref={termRef}>
                <div className="hack-header">
                    <span className="hack-dot hack-dot--red" />
                    <span className="hack-dot hack-dot--yellow" />
                    <span className="hack-dot hack-dot--green" />
                    <span className="hack-title">root@gmu-dining ~ #</span>
                </div>
                <div className="hack-body">
                    {lines.map((line, i) => (
                        <div key={i} className="hack-line" style={{ color: line.color || '#4ade80' }}>
                            {line.text || '\u00A0'}
                        </div>
                    ))}
                    <span className="hack-cursor">_</span>
                </div>
            </div>
        </div>
    );
}

// ── Food Fight Game ────────────────────────────────────────
function FoodFight({ onDone, menuData }) {
    const canvasRef = useRef(null);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [gameOver, setGameOver] = useState(false);
    const foodsRef = useRef([]);
    const scoreRef = useRef(0);
    const animRef = useRef(null);

    // Gather all food names from menu data
    const allFoods = useRef([]);
    useEffect(() => {
        const names = [];
        if (menuData?.menus) {
            for (const periods of Object.values(menuData.menus)) {
                for (const stations of Object.values(periods)) {
                    for (const station of stations) {
                        for (const item of (station.items || [])) {
                            const n = item.name?.trim();
                            if (n && !isBoring(n) && n.length < 30) names.push(formatName(n));
                        }
                    }
                }
            }
        }
        if (names.length === 0) names.push('Chicken Tenders', 'French Fries', 'Soup', 'Burger', 'Salad');
        allFoods.current = names;
    }, [menuData]);

    // Spawn food items
    useEffect(() => {
        const spawn = () => {
            if (allFoods.current.length === 0) return;
            const name = allFoods.current[Math.floor(Math.random() * allFoods.current.length)];
            const canvas = canvasRef.current;
            if (!canvas) return;
            const w = canvas.width;
            const h = canvas.height;
            foodsRef.current.push({
                name,
                x: Math.random() * (w - 120) + 10,
                y: -30,
                vy: 1.5 + Math.random() * 2,
                vx: (Math.random() - 0.5) * 2,
                size: 14 + Math.random() * 6,
                alive: true,
                rotation: (Math.random() - 0.5) * 0.1,
                angle: 0,
            });
        };
        const id = setInterval(spawn, 600);
        return () => clearInterval(id);
    }, []);

    // Game timer
    useEffect(() => {
        if (gameOver) return;
        const id = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    setGameOver(true);
                    clearInterval(id);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [gameOver]);

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dark semi-transparent background
            ctx.fillStyle = 'rgba(17, 17, 17, 0.85)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw food items
            for (const food of foodsRef.current) {
                if (!food.alive) continue;
                food.y += food.vy;
                food.x += food.vx;
                food.angle += food.rotation;

                // Remove if off screen
                if (food.y > canvas.height + 50) {
                    food.alive = false;
                    continue;
                }

                ctx.save();
                ctx.translate(food.x, food.y);
                ctx.rotate(food.angle);
                ctx.font = `${food.size}px Inter, sans-serif`;
                ctx.fillStyle = '#e5e5e5';
                ctx.textAlign = 'center';
                ctx.fillText(food.name, 0, 0);
                ctx.restore();
            }

            // Clean up dead items
            foodsRef.current = foodsRef.current.filter(f => f.alive);

            // HUD
            ctx.font = 'bold 24px Inter, sans-serif';
            ctx.fillStyle = '#4ade80';
            ctx.textAlign = 'left';
            ctx.fillText(`Score: ${scoreRef.current}`, 20, 40);
            ctx.textAlign = 'right';
            ctx.fillStyle = timeLeft <= 5 ? '#f87171' : '#e5e5e5';
            ctx.fillText(`${timeLeft}s`, canvas.width - 20, 40);

            ctx.font = '13px Inter, sans-serif';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('Click the food! Type FOOD again to exit.', canvas.width / 2, canvas.height - 20);

            if (!gameOver) {
                animRef.current = requestAnimationFrame(draw);
            } else {
                // Game over screen
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = 'bold 36px Inter, sans-serif';
                ctx.fillStyle = '#4ade80';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);
                ctx.font = '24px Inter, sans-serif';
                ctx.fillStyle = '#e5e5e5';
                ctx.fillText(`You caught ${scoreRef.current} items`, canvas.width / 2, canvas.height / 2 + 15);
                ctx.font = '14px Inter, sans-serif';
                ctx.fillStyle = '#999';
                const rating = scoreRef.current >= 20 ? 'Dining Hall Legend' : scoreRef.current >= 12 ? 'Meal Swipe Master' : scoreRef.current >= 6 ? 'Cafeteria Regular' : 'Freshman';
                ctx.fillText(rating, canvas.width / 2, canvas.height / 2 + 50);
                ctx.fillText('Click anywhere to close', canvas.width / 2, canvas.height / 2 + 80);
            }
        };
        animRef.current = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [gameOver, timeLeft]);

    // Click handler -- hit detection
    const handleClick = useCallback((e) => {
        if (gameOver) { onDone(); return; }
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        for (const food of foodsRef.current) {
            if (!food.alive) continue;
            const dx = mx - food.x;
            const dy = my - food.y;
            const hitRadius = food.name.length * food.size * 0.3;
            if (Math.abs(dx) < hitRadius && Math.abs(dy) < food.size) {
                food.alive = false;
                scoreRef.current += 1;
                setScore(s => s + 1);
                break;
            }
        }
    }, [gameOver, onDone]);

    return (
        <canvas
            ref={canvasRef}
            className="foodfight-canvas"
            onClick={handleClick}
        />
    );
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
    const [menuData, setMenuData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentPeriod());
    const [logoClicks, setLogoClicks] = useState(0);
    const [hackMode, setHackMode] = useState(false);
    const [foodFightMode, setFoodFightMode] = useState(false);
    const [vibe] = useState(() => getVibeMessage());

    useSecretCode(KONAMI, useCallback(() => setHackMode(true), []));
    useSecretCode(FOOD_CODE, useCallback(() => setFoodFightMode(f => !f), []));

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

    // Build a compact view: for each hall, show only the selected period's items
    const renderHallCard = (hallName, periods, index) => {
        const showAll = selectedPeriod === 'All';
        const periodsToShow = showAll
            ? Object.keys(periods).sort((a, b) => {
                const order = { Breakfast: 0, Lunch: 1, Dinner: 2 };
                return (order[a] ?? 9) - (order[b] ?? 9);
            })
            : [selectedPeriod];

        const hasAnyData = periodsToShow.some(p => (periods[p] || []).length > 0);

        // Fallback: if the selected period has no data, show whatever is available
        let fallbackPeriod = null;
        if (!hasAnyData && !showAll) {
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
                            {(showAll || fallbackPeriod) && (
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
            {hackMode && <HackTerminal onDone={() => setHackMode(false)} menuData={menuData} />}
            {foodFightMode && <FoodFight onDone={() => setFoodFightMode(false)} menuData={menuData} />}

            <header className="header">
                <div className="header-left">
                    <h1 className="logo" onClick={() => setLogoClicks(c => c + 1)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <Utensils size={22} className="logo-icon" />
                        <span>{logoClicks >= 10 ? 'GMU Dining (you found nothing)' : logoClicks >= 5 ? 'stop clicking me' : 'GMU Dining'}</span>
                    </h1>
                    <MealStatus />
                </div>
                <MailPreferences apiBase={API_BASE} />
            </header>

            <main className="main">
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
                            <div className="period-selector">
                                {['Breakfast', 'Lunch', 'Dinner', 'All'].map(p => (
                                    <button
                                        key={p}
                                        className={`period-btn${selectedPeriod === p ? ' period-btn--active' : ''}`}
                                        onClick={() => setSelectedPeriod(p)}
                                    >
                                        {p}
                                    </button>
                                ))}
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
