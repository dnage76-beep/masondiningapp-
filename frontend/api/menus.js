import { Impit } from 'impit';

const LOCATIONS = {
  Southside: '686ff8fb72f475652f1c0bd2',
  "Ike's": '6830a91fe001e1435750226c',
  'The Globe': '6830aa6ae001e14357502486',
};

const ALLOWED_MEALS = new Set(['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Late Night']);

const STATION_KEYWORDS = {
  Southside: ['mason manor', 'patriot pit', 'soup bowl'],
  "Ike's": ['heart of the house', 'flips', 'soup bowl', 'united table'],
  'The Globe': ['cultural crossroads', 'soup'],
};

const UPSTREAM_BASE = 'https://apiv4.dineoncampus.com';
const UPSTREAM_HEADERS = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
};
const upstream = new Impit({ browser: 'chrome' });

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

export function isAllowedStation(hallName, stationName) {
  const normalized = stationName.trim().toLowerCase();
  return STATION_KEYWORDS[hallName].some((keyword) => normalized.includes(keyword));
}

function compactItem(item) {
  return {
    name: item.name,
    calories: item.calories,
    nutrients: item.nutrients,
  };
}

export function compactStations(hallName, stations) {
  return stations
    .filter(
      (station) =>
        isAllowedStation(hallName, station.name ?? '') &&
        Array.isArray(station.items) &&
        station.items.length > 0,
    )
    .map((station) => ({
      name: station.name,
      items: station.items.map(compactItem),
    }));
}

async function fetchJson(url) {
  const response = await upstream.fetch(url, {
    headers: UPSTREAM_HEADERS,
    timeout: 15_000,
  });

  if (!response.ok) {
    throw new Error(`DineOnCampus returned HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchHall(hallName, locationId, date) {
  const periodsUrl = `${UPSTREAM_BASE}/locations/${locationId}/periods?platform=0&date=${date}`;
  const periodsData = await fetchJson(periodsUrl);
  const periods = (periodsData.periods ?? []).filter((period) =>
    ALLOWED_MEALS.has(period.name),
  );

  const menuEntries = await Promise.all(
    periods.map(async (period) => {
      const menuUrl =
        `${UPSTREAM_BASE}/locations/${locationId}/menu` +
        `?date=${date}&period=${period.id}`;
      const menuData = await fetchJson(menuUrl);
      const stations = compactStations(
        hallName,
        menuData.period?.categories ?? [],
      );
      return [period.name, stations];
    }),
  );

  return Object.fromEntries(menuEntries);
}

export async function fetchMenus(date) {
  const menus = {};
  const errors = [];

  await Promise.all(
    Object.entries(LOCATIONS).map(async ([hallName, locationId]) => {
      try {
        menus[hallName] = await fetchHall(hallName, locationId, date);
      } catch (error) {
        menus[hallName] = {};
        errors.push(`${hallName}: ${error.message}`);
      }
    }),
  );

  return { date, menus, errors };
}

function hasMenuItems(menus) {
  return Object.values(menus).some((periods) =>
    Object.values(periods).some((stations) =>
      stations.some((station) => station.items.length > 0),
    ),
  );
}

export default async function handler(_request, response) {
  const date = getEasternDate();
  const payload = await fetchMenus(date);

  if (!hasMenuItems(payload.menus)) {
    response.setHeader('Cache-Control', 'no-store');
    response.status(502).json({
      ...payload,
      error: 'DineOnCampus did not return any menu items.',
    });
    return;
  }

  response.setHeader(
    'Cache-Control',
    payload.errors.length === 0
      ? 's-maxage=900, stale-while-revalidate=3600'
      : 'no-store',
  );
  response.status(200).json(payload);
}
