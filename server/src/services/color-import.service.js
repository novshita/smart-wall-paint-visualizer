const Joi = require('joi');
const { Color } = require('../models');
const { hexToRgb } = require('../utils/color');
const { colorFields } = require('../validators/admin.validators');

const MAX_ROWS = 2000;

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, commas/newlines in quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Splits "a; b|c" style list cells used for finishes and tags. */
const list = (value) =>
  typeof value === 'string'
    ? value
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : value;

function rowsFromCsv(text) {
  const [header, ...data] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return data.map((cells) => {
    const obj = {};
    keys.forEach((k, i) => {
      if (cells[i] !== undefined && cells[i].trim() !== '') obj[k] = cells[i].trim();
    });
    return obj;
  });
}

const importRow = Joi.object({
  ...colorFields,
  code: colorFields.code.required(),
  name: colorFields.name.required(),
  hex: colorFields.hex.required(),
  family: colorFields.family.required(),
}).options({ stripUnknown: true, convert: true });

/**
 * Bulk import (FR-AD3). Accepts CSV (header row: code,name,hex,family,brand,finishes,tags)
 * or a JSON array. Upserts by code, so re-importing a sheet updates existing colours.
 */
async function importColors(content, format) {
  let rows;
  if (format === 'json') {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { created: 0, updated: 0, errors: [{ row: 0, message: 'File is not valid JSON' }] };
    }
    rows = Array.isArray(parsed) ? parsed : parsed?.colors;
    if (!Array.isArray(rows)) {
      return {
        created: 0,
        updated: 0,
        errors: [{ row: 0, message: 'Expected an array of colours' }],
      };
    }
  } else {
    rows = rowsFromCsv(content);
  }
  if (rows.length > MAX_ROWS) {
    return {
      created: 0,
      updated: 0,
      errors: [{ row: 0, message: `Too many rows (max ${MAX_ROWS} per import)` }],
    };
  }

  const result = { created: 0, updated: 0, errors: [] };
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = format === 'json' ? i + 1 : i + 2; // CSV: account for header row
    const raw = rows[i] ?? {};
    const { value, error } = importRow.validate({
      ...raw,
      finishes: list(raw.finishes),
      tags: list(raw.tags),
    });
    if (error) {
      result.errors.push({ row: rowNumber, message: error.details[0].message });
      continue;
    }
    if (seen.has(value.code)) {
      result.errors.push({ row: rowNumber, message: `Duplicate code ${value.code} in file` });
      continue;
    }
    seen.add(value.code);

    const doc = { isActive: true, ...value, rgb: hexToRgb(value.hex) };
    const res = await Color.updateOne({ code: value.code }, { $set: doc }, { upsert: true });
    if (res.upsertedCount) result.created++;
    else result.updated++;
  }
  return result;
}

module.exports = { importColors, parseCsv, MAX_ROWS };
