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

// ── Konami Code Hook ──────────────────────────────────────
function useKonami(callback) {
    useEffect(() => {
        const code = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
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

// ── Interactive Terminal ───────────────────────────────────
function getAllFoodNames(menuData) {
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
    return names;
}

function processCommand(cmd, menuData) {
    const c = cmd.trim().toLowerCase();

    if (c === 'help') return [
        { text: 'Available commands:', color: '#eab308' },
        { text: '  help          -- show this message' },
        { text: '  hack          -- breach the dining mainframe' },
        { text: '  foodfight     -- launch food fight mini-game' },
        { text: '  roast         -- roast a random dining hall' },
        { text: '  rate          -- today\'s menu rating' },
        { text: '  secret        -- classified dining intel' },
        { text: '  whoami        -- identity check' },
        { text: '  sudo          -- try it' },
        { text: '  fortune       -- dining hall fortune cookie' },
        { text: '  matrix        -- you know what this does' },
        { text: '  exit          -- close terminal' },
        { text: '' },
        { text: 'Type any command and press Enter.', color: '#666' },
    ];

    if (c === 'hack') return [
        { text: '> Initializing GMU Dining Mainframe breach...', color: '#4ade80' },
        { text: '> Connecting to dining.gmu.edu:4433...' },
        { text: '> SSL handshake intercepted' },
        { text: '> Bypassing Sodexo firewall...' },
        { text: '[################] 100% -- FIREWALL BYPASSED', color: '#4ade80' },
        { text: '' },
        { text: '=== CLASSIFIED: chicken_tenders_recipe.txt ===', color: '#eab308' },
        { text: 'INGREDIENTS: Tyson frozen bag, fryer, prayer', color: '#ccc' },
        { text: '' },
        { text: '=== CLASSIFIED: health_inspection_2024.pdf ===', color: '#eab308' },
        { text: 'Southside: "We have concerns"', color: '#f87171' },
        { text: "Ike's: \"The ice cream machine has never worked\"", color: '#f87171' },
        { text: 'The Globe: "Actually fine somehow"', color: '#4ade80' },
        { text: '' },
        { text: '=== CLASSIFIED: staff_spotify_playlist.csv ===', color: '#eab308' },
        { text: '1. "Welcome to the Jungle" - Guns N Roses', color: '#ccc' },
        { text: '2. "Under Pressure" - Queen', color: '#ccc' },
        { text: '3. "Highway to Hell" - AC/DC', color: '#ccc' },
        { text: '' },
        { text: '=== CLASSIFIED: real_food_costs.xlsx ===', color: '#eab308' },
        { text: 'Dining dollar value: $1.00 = $0.23 actual food', color: '#f87171' },
        { text: 'Meal swipe cost to GMU: $3.47', color: '#f87171' },
        { text: 'Meal swipe cost to you: $17.50', color: '#f87171' },
        { text: '' },
        { text: '=== CLASSIFIED: renovation_plans_2027.txt ===', color: '#eab308' },
        { text: 'Southside to be renamed "Sadside" per student vote', color: '#ccc' },
        { text: "Ike's adding a Chick-fil-A (UNCONFIRMED)", color: '#4ade80' },
        { text: '' },
        { text: '> ALERT: Campus police notified', color: '#f87171' },
        { text: '> Erasing logs... done', color: '#4ade80' },
    ];

    if (c === 'roast') {
        const halls = ["Ike's", "Southside", "The Globe"];
        const hall = halls[Math.floor(Math.random() * halls.length)];
        const roasts = {
            "Ike's": [
                "Ike's Heart of the House is just a roulette wheel where every slot is 'carved entree'.",
                "Ike's Flips thinks putting something between two buns makes it gourmet.",
                "The Ike's stir-fry bar is what happens when you give an 18 year old a wok and no training.",
                "Ike's is the dining hall you go to when you've given up on having standards.",
                "Ike's omelet bar: where dreams of a good breakfast go to die in egg whites.",
            ],
            "Southside": [
                "Southside Manor serves food that's technically edible. Technically.",
                "Southside Patriot Pit is just a Burger King with worse lighting.",
                "Going to Southside is like choosing the middle option on everything. You won't hate it. You won't remember it.",
                "Southside soup is just water that looked at a vegetable once.",
                "Southside's best quality is that it's close to the parking garage so you can leave faster.",
            ],
            "The Globe": [
                "The Globe's 'Cultural Crossroads' is doing a lot of heavy lifting for one station.",
                "The Globe is what happens when a dining hall has a midlife crisis and tries to be worldly.",
                "Eating at the Globe feels like a field trip nobody asked for.",
                "The Globe is the dining hall equivalent of that one friend who studied abroad for a semester and won't shut up about it.",
                "The Globe's soup is actually good though. I got nothing. Carry on.",
            ],
        };
        const r = roasts[hall][Math.floor(Math.random() * roasts[hall].length)];
        return [
            { text: `Roasting ${hall}...`, color: '#eab308' },
            { text: '' },
            { text: r, color: '#f87171' },
        ];
    }

    if (c === 'rate') {
        const foods = getAllFoodNames(menuData);
        const score = (Math.random() * 4 + 3).toFixed(1); // 3.0 - 7.0
        const verdicts = [
            'Edible. Barely.', 'Could be worse.', 'Mid.', 'Actually not terrible.',
            'Surprisingly decent.', 'Your tuition at work.', 'You get what you pay for.',
            'The soup carries.', "It's giving cafeteria.", 'Peak mid-tier.',
        ];
        const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];
        return [
            { text: `Today's Menu Rating: ${score}/10`, color: '#eab308' },
            { text: `Verdict: ${verdict}`, color: '#ccc' },
            { text: `Items available: ${foods.length}`, color: '#666' },
            { text: `Best looking item: ${foods[Math.floor(Math.random() * foods.length)]}`, color: '#4ade80' },
            { text: `Worst looking item: ${foods[Math.floor(Math.random() * foods.length)]}`, color: '#f87171' },
        ];
    }

    if (c === 'secret') {
        const secrets = [
            ["The Ike's soft serve machine has been 'broken' 47 times this semester.", "It works. They just don't want to clean it."],
            ["Southside Manor's 'chef special' is just whatever didn't sell yesterday.", "This is not a joke."],
            ["The Globe's soup recipe is from a 2009 Allrecipes post.", "It still slaps though."],
            ["There are exactly 3 students who have eaten at all 3 dining halls in one day.", "Two of them regret it. One became a legend."],
            ["The dining halls collectively waste 847 lbs of food per week.", "But they ran out of chicken tenders at 6pm. Make it make sense."],
            ["A Southside worker once found a student napping in the back booth for 4 hours.", "They let him sleep. Respect."],
            ["The campus squirrels eat better than you.", "They have access to all 3 dining halls without a meal plan."],
            ["Ike's has a secret menu item: ask for 'The Patriot' at Flips.", "Just kidding. They'll look at you weird."],
        ];
        const s = secrets[Math.floor(Math.random() * secrets.length)];
        return [
            { text: '=== DECLASSIFIED ===', color: '#eab308' },
            { text: s[0], color: '#ccc' },
            { text: s[1], color: '#666' },
        ];
    }

    if (c === 'whoami') return [
        { text: 'root@gmu-dining', color: '#4ade80' },
        { text: 'Access level: HUNGRY', color: '#ccc' },
        { text: 'Meal swipes remaining: Not enough', color: '#f87171' },
        { text: 'Dining dollar balance: Concerning', color: '#f87171' },
        { text: 'Favorite hall: You have no loyalty', color: '#666' },
    ];

    if (c === 'sudo' || c.startsWith('sudo ')) return [
        { text: `[sudo] password for student: `, color: '#ccc' },
        { text: 'student is not in the sudoers file.', color: '#f87171' },
        { text: 'This incident will be reported to Housing & Residence Life.', color: '#f87171' },
    ];

    if (c === 'fortune') {
        const fortunes = [
            "The chicken today will be... acceptable.",
            "You will stand in line for 20 minutes and it will not be worth it.",
            "A great soup awaits you. But not at Southside.",
            "Today is a good day to try the Globe. Tomorrow, not so much.",
            "Your meal swipes are finite. Choose wisely. You won't.",
            "Someone will take the last chicken tenders right before you. Accept this.",
            "The salad bar holds the key to your health. You will ignore it.",
            "Beware the 'daily special.' It's only special because nobody ordered it yesterday.",
            "A fork will break today. It may be yours.",
            "You will make eye contact with a dining hall worker and both of you will look away.",
            "The dining hall closes in less time than you think. Run.",
            "You will tell yourself you'll eat healthy today. You will not.",
        ];
        const f = fortunes[Math.floor(Math.random() * fortunes.length)];
        return [
            { text: '=== YOUR DINING FORTUNE ===', color: '#eab308' },
            { text: '' },
            { text: f, color: '#ccc' },
        ];
    }

    if (c === 'matrix') return [
        { text: 'Waking up...', color: '#4ade80' },
        { text: '' },
        { text: 'The Matrix has you, Neo.', color: '#4ade80' },
        { text: '' },
        { text: 'You think that\'s chicken you\'re eating?', color: '#4ade80' },
        { text: '' },
        { text: 'There is no spoon. There is only a spork.', color: '#4ade80' },
        { text: 'And it\'s the last clean one.', color: '#666' },
    ];

    if (c === 'jillian' || c === 'jill') {
        const letters = [
            [
                'Hey Jill,',
                '',
                'You make everything better. The good days,',
                'the hard days, the boring ones in between.',
                'I don\'t say it enough but I think about',
                'how lucky I am pretty much all the time.',
                '',
                'I love you.',
            ],
            [
                'Jill,',
                '',
                'I fall for you a little more every single',
                'day and I didn\'t even know that was possible.',
                'You are the best thing that ever happened to me',
                'and I will never stop telling you that.',
            ],
            [
                'Hey you,',
                '',
                'I hope you know that you\'re my favorite',
                'person in the world. Not close. Not even',
                'a competition. Just you. Always you.',
            ],
            [
                'Jill,',
                '',
                'Some people search their whole life for',
                'what I found in you. I don\'t take that',
                'for granted. Not for a single second.',
                '',
                'You\'re my person.',
            ],
            [
                'Hey Jill,',
                '',
                'I love the way you laugh when something',
                'catches you off guard. I love how you care',
                'about people so deeply it\'s almost unfair.',
                'I love that you chose me.',
                '',
                'I\'ll keep choosing you back. Every time.',
            ],
            [
                'Jill,',
                '',
                'The distance is hard sometimes. But then',
                'I hear your voice and none of it matters.',
                'You\'re worth every mile. Every minute.',
                'Every single second of waiting.',
            ],
            [
                'Hey,',
                '',
                'You walked into my life and made it',
                'something I actually look forward to.',
                'I didn\'t know it could feel like this.',
                'Thank you for showing me.',
                '',
                'I love you so much.',
            ],
            [
                'Jill,',
                '',
                'When everything feels heavy, you make',
                'it feel light again. You don\'t even have',
                'to try. You just do. That\'s who you are.',
                '',
                'And I\'m so grateful you\'re mine.',
            ],
            [
                'Hey Jill,',
                '',
                'I want you to know something. No matter',
                'how crazy life gets, no matter how far',
                'apart we are on any given day, you are',
                'the first thing I think about when I',
                'wake up and the last thing before I sleep.',
            ],
            [
                'Jill,',
                '',
                'I don\'t need a perfect life. I just need',
                'you in it. That\'s the whole list. That\'s',
                'everything. Just you.',
            ],
            [
                'Hey you,',
                '',
                'I know I\'m not always great with words.',
                'But what I feel for you is the most real',
                'thing I\'ve ever known. You make me want',
                'to be better. You make me believe I can be.',
                '',
                'I love you more than I know how to say.',
            ],
            [
                'Jill,',
                '',
                'You are so much stronger than you give',
                'yourself credit for. I watch you handle',
                'everything life throws at you and I\'m',
                'just in awe. Every single time.',
                '',
                'I\'m so proud of you.',
            ],
            [
                'Hey Jill,',
                '',
                'There are a million things I could say',
                'but they all come back to the same thing.',
                'I love you. Simply. Completely. Without',
                'any conditions. Just love.',
            ],
            [
                'Jill,',
                '',
                'You know what I love most? That we can',
                'be ourselves with each other. No act.',
                'No pretending. Just us. That\'s rare.',
                'That\'s everything.',
            ],
            [
                'Hey,',
                '',
                'Some days I still can\'t believe you\'re',
                'real. That someone this kind, this funny,',
                'this beautiful actually exists. And then',
                'you call me and I remember. Yeah. She\'s real.',
                'And she\'s mine.',
            ],
            [
                'Jill,',
                '',
                'I would rather have a hard day with you',
                'than a perfect day without you. That\'s',
                'how I know this is it. You\'re it.',
            ],
            [
                'Hey Jill,',
                '',
                'Loving you is the easiest thing I\'ve',
                'ever done. Everything else takes effort.',
                'But this? This just makes sense.',
            ],
            [
                'Jill,',
                '',
                'I think about our future all the time.',
                'Not in a stressful way. In a way that',
                'makes me smile. Because any future with',
                'you in it is one I want.',
            ],
            [
                'Hey you,',
                '',
                'I don\'t need you to be perfect. I just',
                'need you to be you. Because the real you',
                'is the person I fell in love with and I',
                'fall a little harder every day.',
            ],
            [
                'Jill,',
                '',
                'You are home to me. Not a place. Not',
                'a city. You. Wherever you are is where',
                'I want to be. It\'s that simple.',
                '',
                'I love you endlessly.',
            ],
        ];
        const letter = letters[Math.floor(Math.random() * letters.length)];
        return [
            { text: '' },
            { text: '-----------------------------------------------', color: '#f9a8d4' },
            { text: '' },
            ...letter.map(line => ({ text: line || '\u00A0', color: '#fdf2f8' })),
            { text: '' },
            { text: '- D', color: '#f9a8d4' },
            { text: '' },
            { text: '-----------------------------------------------', color: '#f9a8d4' },
            { text: '' },
        ];
    }

    if (c === 'foodfight') return '__FOODFIGHT__';

    if (c === 'exit' || c === 'quit' || c === 'q') return '__EXIT__';

    if (c === 'ls') return [
        { text: 'chicken_tenders_recipe.txt  health_inspection.pdf', color: '#60a5fa' },
        { text: 'staff_playlist.csv          food_costs.xlsx', color: '#60a5fa' },
        { text: 'renovation_plans.txt        secret_menu.md', color: '#60a5fa' },
        { text: '' },
        { text: 'Try "hack" to access these files.', color: '#666' },
    ];

    if (c === 'cd' || c.startsWith('cd ')) return [
        { text: 'bash: cd: /var/dining/kitchen: Permission denied', color: '#f87171' },
        { text: 'Nice try though.', color: '#666' },
    ];

    if (c === 'rm' || c.startsWith('rm ')) return [
        { text: 'rm: cannot remove dining hall: Operation not permitted', color: '#f87171' },
        { text: 'Trust me, we\'ve all tried.', color: '#666' },
    ];

    if (c === 'cat' || c.startsWith('cat ')) return [
        { text: '   /\\_/\\', color: '#ccc' },
        { text: '  ( o.o )', color: '#ccc' },
        { text: '   > ^ <', color: '#ccc' },
        { text: '', },
        { text: 'Wrong kind of cat. But here you go.', color: '#666' },
    ];

    if (c === 'clear') return '__CLEAR__';

    if (c === '') return [];

    return [
        { text: `bash: ${cmd.trim()}: command not found`, color: '#f87171' },
        { text: 'Type "help" for available commands.', color: '#666' },
    ];
}

function Terminal({ onDone, menuData, onFoodFight }) {
    const [history, setHistory] = useState([
        { text: 'GMU Dining Mainframe v4.2.0', color: '#4ade80' },
        { text: 'Unauthorized access detected. Welcome anyway.', color: '#666' },
        { text: 'Type "help" for available commands.', color: '#666' },
        { text: '' },
    ]);
    const [input, setInput] = useState('');
    const bodyRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [history]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const cmd = input;
        setInput('');

        const prompt = { text: `$ ${cmd}`, color: '#4ade80' };
        const result = processCommand(cmd, menuData);

        if (result === '__EXIT__') { onDone(); return; }
        if (result === '__CLEAR__') { setHistory([]); return; }
        if (result === '__FOODFIGHT__') {
            setHistory(prev => [...prev, prompt, { text: 'Launching food fight...', color: '#eab308' }]);
            setTimeout(() => onFoodFight(), 300);
            return;
        }

        setHistory(prev => [...prev, prompt, ...result, { text: '' }]);
    };

    return (
        <div className="hack-overlay" onClick={() => inputRef.current?.focus()}>
            <div className="hack-terminal" onClick={(e) => e.stopPropagation()}>
                <div className="hack-header">
                    <span className="hack-dot hack-dot--red" onClick={onDone} style={{ cursor: 'pointer' }} />
                    <span className="hack-dot hack-dot--yellow" />
                    <span className="hack-dot hack-dot--green" />
                    <span className="hack-title">root@gmu-dining ~ #</span>
                </div>
                <div className="hack-body" ref={bodyRef}>
                    {history.map((line, i) => (
                        <div key={i} className="hack-line" style={{ color: line.color || '#4ade80' }}>
                            {line.text || '\u00A0'}
                        </div>
                    ))}
                    <form onSubmit={handleSubmit} className="hack-input-row">
                        <span style={{ color: '#4ade80' }}>$ </span>
                        <input
                            ref={inputRef}
                            className="hack-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}

// ── Food Fight Game ────────────────────────────────────────
const FOOD_EMOJIS = ['🍗', '🍔', '🌮', '🍕', '🥗', '🍜', '🍟', '🥪', '🌯', '🍲', '🥩', '🍳', '🧇', '🥞', '🍝', '🍱'];
const SPLAT_COLORS = ['#4ade80', '#60a5fa', '#f87171', '#eab308', '#c084fc', '#fb923c', '#f472b6'];
const GAME_DURATION = 20;

function FoodFight({ onDone, menuData }) {
    const canvasRef = useRef(null);
    const scoreRef = useRef(0);
    const animRef = useRef(null);
    const timeRef = useRef(GAME_DURATION);
    const foodsRef = useRef([]);
    const particlesRef = useRef([]);
    const floatsRef = useRef([]);
    const gameOverRef = useRef(false);
    const [, forceRender] = useState(0);

    const allFoods = useRef(getAllFoodNames(menuData));

    // Spawner -- gradually gets faster
    useEffect(() => {
        let timer = null;
        let elapsed = 0;
        const tick = () => {
            elapsed++;
            const rate = Math.max(350, 550 - elapsed * 8);
            timer = setTimeout(() => {
                const canvas = canvasRef.current;
                if (!canvas || gameOverRef.current) return;
                const name = allFoods.current[Math.floor(Math.random() * allFoods.current.length)];
                const emoji = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
                const speedMult = 1 + elapsed * 0.015;
                foodsRef.current.push({
                    name, emoji,
                    x: 60 + Math.random() * (canvas.width - 120),
                    y: -40,
                    vy: (1.2 + Math.random() * 1.8) * speedMult,
                    vx: (Math.random() - 0.5) * 2,
                    size: 14 + Math.random() * 4,
                    alive: true,
                    rotation: (Math.random() - 0.5) * 0.06,
                    angle: 0,
                });
                tick();
            }, rate);
        };
        tick();
        return () => clearTimeout(timer);
    }, []);

    // Countdown
    useEffect(() => {
        const id = setInterval(() => {
            timeRef.current -= 1;
            if (timeRef.current <= 0) {
                gameOverRef.current = true;
                forceRender(n => n + 1);
                clearInterval(id);
            }
        }, 1000);
        return () => clearInterval(id);
    }, []);

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(17, 17, 17, 0.9)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Particles
            for (const p of particlesRef.current) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.12;
                p.life -= 0.025;
                if (p.life <= 0) continue;
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            particlesRef.current = particlesRef.current.filter(p => p.life > 0);

            // Floating +1 texts
            for (const ft of floatsRef.current) {
                ft.y -= 1.2;
                ft.life -= 0.02;
                if (ft.life <= 0) continue;
                ctx.globalAlpha = ft.life;
                ctx.font = `bold ${ft.size}px Inter, sans-serif`;
                ctx.fillStyle = ft.color;
                ctx.textAlign = 'center';
                ctx.fillText(ft.text, ft.x, ft.y);
            }
            ctx.globalAlpha = 1;
            floatsRef.current = floatsRef.current.filter(ft => ft.life > 0);

            // Food items
            for (const food of foodsRef.current) {
                if (!food.alive) continue;
                food.y += food.vy;
                food.x += food.vx;
                food.angle += food.rotation;
                if (food.x < 20 || food.x > canvas.width - 20) food.vx *= -1;
                if (food.y > canvas.height + 50) { food.alive = false; continue; }

                ctx.save();
                ctx.translate(food.x, food.y);
                ctx.rotate(food.angle);

                ctx.font = `${food.size + 6}px serif`;
                ctx.textAlign = 'center';
                ctx.fillText(food.emoji, 0, -food.size * 0.2);

                ctx.font = `${food.size}px Inter, sans-serif`;
                ctx.fillStyle = '#e5e5e5';
                ctx.fillText(food.name, 0, food.size * 0.9);
                ctx.restore();
            }
            foodsRef.current = foodsRef.current.filter(f => f.alive);

            // HUD -- score
            ctx.font = 'bold 26px Inter, sans-serif';
            ctx.fillStyle = '#4ade80';
            ctx.textAlign = 'left';
            ctx.fillText(scoreRef.current, 20, 38);
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = '#555';
            ctx.fillText('SCORE', 20, 54);

            // HUD -- timer
            ctx.font = 'bold 26px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = timeRef.current <= 5 ? '#f87171' : timeRef.current <= 10 ? '#eab308' : '#e5e5e5';
            ctx.fillText(timeRef.current, canvas.width - 20, 38);
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = '#555';
            ctx.fillText('TIME', canvas.width - 20, 54);

            // Bottom hint
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.fillText('Click the food to catch it', canvas.width / 2, canvas.height - 14);

            if (gameOverRef.current) {
                ctx.fillStyle = 'rgba(0,0,0,0.75)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const cy = canvas.height / 2;

                ctx.font = 'bold 38px Inter, sans-serif';
                ctx.fillStyle = '#4ade80';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width / 2, cy - 50);

                ctx.font = 'bold 52px Inter, sans-serif';
                ctx.fillStyle = '#e5e5e5';
                ctx.fillText(scoreRef.current, canvas.width / 2, cy + 10);

                ctx.font = 'bold 16px Inter, sans-serif';
                let rating, rc;
                const s = scoreRef.current;
                if (s >= 40) { rating = 'Dining Hall Legend'; rc = '#c084fc'; }
                else if (s >= 25) { rating = 'Head Chef'; rc = '#eab308'; }
                else if (s >= 15) { rating = 'Line Cook'; rc = '#4ade80'; }
                else if (s >= 8) { rating = 'Cafeteria Regular'; rc = '#60a5fa'; }
                else { rating = 'Freshman'; rc = '#f87171'; }
                ctx.fillStyle = rc;
                ctx.fillText(rating, canvas.width / 2, cy + 50);

                ctx.font = '13px Inter, sans-serif';
                ctx.fillStyle = '#555';
                ctx.fillText('Click anywhere to close', canvas.width / 2, cy + 85);
            } else {
                animRef.current = requestAnimationFrame(draw);
            }
        };
        animRef.current = requestAnimationFrame(draw);
        return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
    }, []);

    // Re-draw once on game over to show the end screen
    useEffect(() => {
        if (gameOverRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const cy = canvas.height / 2;
            ctx.font = 'bold 38px Inter, sans-serif';
            ctx.fillStyle = '#4ade80';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', canvas.width / 2, cy - 50);
            ctx.font = 'bold 52px Inter, sans-serif';
            ctx.fillStyle = '#e5e5e5';
            ctx.fillText(scoreRef.current, canvas.width / 2, cy + 10);
            ctx.font = 'bold 16px Inter, sans-serif';
            const s = scoreRef.current;
            let rating, rc;
            if (s >= 40) { rating = 'Dining Hall Legend'; rc = '#c084fc'; }
            else if (s >= 25) { rating = 'Head Chef'; rc = '#eab308'; }
            else if (s >= 15) { rating = 'Line Cook'; rc = '#4ade80'; }
            else if (s >= 8) { rating = 'Cafeteria Regular'; rc = '#60a5fa'; }
            else { rating = 'Freshman'; rc = '#f87171'; }
            ctx.fillStyle = rc;
            ctx.fillText(rating, canvas.width / 2, cy + 50);
            ctx.font = '13px Inter, sans-serif';
            ctx.fillStyle = '#555';
            ctx.fillText('Click anywhere to close', canvas.width / 2, cy + 85);
        }
    });

    const handleClick = useCallback((e) => {
        if (gameOverRef.current) { onDone(); return; }
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        for (const food of foodsRef.current) {
            if (!food.alive) continue;
            const hw = food.name.length * food.size * 0.28;
            const hh = food.size * 1.4;
            if (Math.abs(mx - food.x) < hw && Math.abs(my - food.y) < hh) {
                food.alive = false;
                scoreRef.current += 1;

                // Burst particles
                const color = SPLAT_COLORS[Math.floor(Math.random() * SPLAT_COLORS.length)];
                for (let i = 0; i < 10; i++) {
                    const ang = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.4;
                    particlesRef.current.push({
                        x: food.x, y: food.y,
                        vx: Math.cos(ang) * (2 + Math.random() * 3),
                        vy: Math.sin(ang) * (2 + Math.random() * 3) - 1.5,
                        r: 2 + Math.random() * 3,
                        color, life: 0.6 + Math.random() * 0.4,
                    });
                }

                // Floating +1
                floatsRef.current.push({
                    x: food.x, y: food.y - 15,
                    text: '+1', color: '#4ade80', size: 20, life: 1,
                });
                break;
            }
        }
    }, [onDone]);

    return <canvas ref={canvasRef} className="foodfight-canvas" onClick={handleClick} />;
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
    const [menuData, setMenuData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentPeriod());
    const [logoClicks, setLogoClicks] = useState(0);
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [foodFightMode, setFoodFightMode] = useState(false);
    const [vibe] = useState(() => getVibeMessage());

    useKonami(useCallback(() => setTerminalOpen(true), []));

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
            {terminalOpen && (
                <Terminal
                    onDone={() => setTerminalOpen(false)}
                    menuData={menuData}
                    onFoodFight={() => { setTerminalOpen(false); setFoodFightMode(true); }}
                />
            )}
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
