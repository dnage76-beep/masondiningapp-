import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactStations,
  getEasternDate,
  isAllowedStation,
} from '../api/menus.js';

test('uses the Eastern calendar date near UTC midnight', () => {
  assert.equal(getEasternDate(new Date('2026-09-10T01:30:00Z')), '2026-09-09');
});

test('matches the configured stations without case sensitivity', () => {
  assert.equal(isAllowedStation('Southside', 'The Soup Bowl'), true);
  assert.equal(isAllowedStation('Southside', 'Desserts'), false);
});

test('drops unrelated and empty stations and compacts menu items', () => {
  const stations = compactStations('Southside', [
    { name: 'Mason Manor', items: [] },
    { name: 'Desserts', items: [{ name: 'Cake' }] },
    {
      name: 'Patriot Pit',
      items: [
        {
          name: 'Burger',
          calories: 450,
          ingredients: 'not sent to the browser',
          nutrients: [{ name: 'Protein (g)', value: '25' }],
        },
      ],
    },
  ]);

  assert.deepEqual(stations, [
    {
      name: 'Patriot Pit',
      items: [
        {
          name: 'Burger',
          calories: 450,
          nutrients: [{ name: 'Protein (g)', value: '25' }],
        },
      ],
    },
  ]);
});
