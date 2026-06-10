function normalizeAadharNo(value) {
  return value.replace(/\s/g, '');
}

function isValidAadharNo(value) {
  const normalized = normalizeAadharNo(value);
  return /^\d{12}$/.test(normalized);
}

module.exports = { normalizeAadharNo, isValidAadharNo };
