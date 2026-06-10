function normalizePhone(phone) {
  return phone.replace(/[\s-]/g, '');
}

function isValidPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^(\+91)?[6-9]\d{9}$/.test(normalized);
}

module.exports = { normalizePhone, isValidPhone };
