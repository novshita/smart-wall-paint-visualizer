/** Escapes user input for safe use inside a RegExp (prevents ReDoS / injection). */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
