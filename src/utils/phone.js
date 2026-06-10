function normalizePhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s-]/g, '');
  return cleaned.startsWith('+91') ? cleaned.slice(3) : cleaned;
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^[6-9]\d{9}$/.test(normalized);
}

function phonesEqual(phoneA, phoneB) {
  return normalizePhone(phoneA) === normalizePhone(phoneB);
}

module.exports = { normalizePhone, isValidPhone, phonesEqual };
