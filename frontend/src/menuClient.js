// Loads menus with timeouts, retries, and a per-day saved copy so the app still works on flaky campus Wi-Fi.

const CACHE_PREFIX = 'menus:';
const CACHE_DAYS_KEPT = 7;

export function getEasternDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().slice(0, 10);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchMenusWithRetry(baseUrl, date, {
    attempts = 3,
    timeoutMs = 12_000,
    backoffMs = 1_000,
    fetchImpl = fetch,
} = {}) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await wait(backoffMs * 2 ** (attempt - 1));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetchImpl(`${baseUrl}/api/menus?date=${date}`, {
                signal: controller.signal,
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            return await res.json();
        } catch (err) {
            lastError = err.name === 'AbortError'
                ? new Error('The connection timed out. Check your Wi-Fi and try again.')
                : err instanceof TypeError
                    ? new Error("Couldn't reach the server. Check your Wi-Fi and try again.")
                    : err;
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError;
}

function storage() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

export function readSavedMenus(date) {
    try {
        const raw = storage()?.getItem(CACHE_PREFIX + date);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveMenus(data, today = getEasternDate()) {
    const store = storage();
    if (!store || !data?.date) return;
    try {
        store.setItem(CACHE_PREFIX + data.date, JSON.stringify(data));
        const oldest = addDays(today, -CACHE_DAYS_KEPT);
        for (let i = store.length - 1; i >= 0; i--) {
            const key = store.key(i);
            if (key?.startsWith(CACHE_PREFIX) && key.slice(CACHE_PREFIX.length) < oldest) {
                store.removeItem(key);
            }
        }
    } catch {
        // Storage full or blocked; the app still works without a saved copy.
    }
}
