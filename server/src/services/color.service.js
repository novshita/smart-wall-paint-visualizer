const { Color } = require('../models');
const { escapeRegex } = require('../utils/regex');

// Display order for colour families: light to dark neutrals, then the colour wheel.
// Families not listed here (e.g. added later by an admin) are appended alphabetically.
const FAMILY_ORDER = [
  'White',
  'Neutral',
  'Grey',
  'Yellow',
  'Orange',
  'Red',
  'Pink',
  'Purple',
  'Blue',
  'Green',
];

function familyRank(family) {
  const i = FAMILY_ORDER.indexOf(family);
  return i === -1 ? FAMILY_ORDER.length : i;
}

/** Builds a Mongo filter from validated list query params. Only active colours are public. */
function buildColorFilter({ q, family, brand, finish, tag }) {
  const filter = { isActive: true };
  if (family) filter.family = family;
  if (brand) filter.brand = brand;
  if (finish) filter.finishes = finish;
  if (tag) filter.tags = tag;

  if (q) {
    const hex = q.replace(/^#/, '');
    if (/^[0-9a-f]{3,6}$/i.test(hex) && q.startsWith('#')) {
      // Explicit "#..." search: match HEX prefix only
      filter.hex = new RegExp(`^#${hex}`, 'i');
    } else {
      const rx = new RegExp(escapeRegex(q), 'i');
      const or = [{ name: rx }, { code: rx }];
      if (/^[0-9a-f]{3,6}$/i.test(hex)) or.push({ hex: new RegExp(`^#${hex}`, 'i') });
      filter.$or = or;
    }
  }
  return filter;
}

async function listColors(query) {
  const { page, limit, sort } = query;
  const filter = buildColorFilter(query);

  if (sort === 'family') {
    // Sort by the curated family order, then by code within a family
    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          _familyRank: {
            $let: {
              vars: { i: { $indexOfArray: [FAMILY_ORDER, '$family'] } },
              in: { $cond: [{ $eq: ['$$i', -1] }, FAMILY_ORDER.length, '$$i'] },
            },
          },
        },
      },
      { $sort: { _familyRank: 1, family: 1, code: 1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { _familyRank: 0, __v: 0 } },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ];
    const [{ items, total }] = await Color.aggregate(pipeline);
    return paged(items, total[0]?.n ?? 0, page, limit);
  }

  const sortSpec = sort === 'name' ? { name: 1 } : { code: 1 };
  const [items, total] = await Promise.all([
    Color.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v')
      .lean(),
    Color.countDocuments(filter),
  ]);
  return paged(items, total, page, limit);
}

function paged(items, total, page, limit) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Distinct filter values with counts, for building the library's filter panel. */
async function colorFacets() {
  const [result] = await Color.aggregate([
    { $match: { isActive: true } },
    {
      $facet: {
        families: [
          { $sort: { code: 1 } },
          { $group: { _id: '$family', count: { $sum: 1 }, sampleHex: { $first: '$hex' } } },
        ],
        brands: [{ $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        tags: [
          { $unwind: '$tags' },
          { $group: { _id: '$tags', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        finishes: [{ $unwind: '$finishes' }, { $group: { _id: '$finishes', count: { $sum: 1 } } }],
      },
    },
  ]);

  const toList = (rows) => rows.map(({ _id, ...rest }) => ({ value: _id, ...rest }));
  const families = toList(result.families).sort(
    (a, b) => familyRank(a.value) - familyRank(b.value) || a.value.localeCompare(b.value),
  );
  const finishOrder = Color.FINISHES;
  const finishes = toList(result.finishes).sort(
    (a, b) => finishOrder.indexOf(a.value) - finishOrder.indexOf(b.value),
  );

  return { families, brands: toList(result.brands), tags: toList(result.tags), finishes };
}

module.exports = { listColors, colorFacets, buildColorFilter, FAMILY_ORDER };
