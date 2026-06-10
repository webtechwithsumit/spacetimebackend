const ROLES = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
  BROKER: 'Broker',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super-Admin',
};

const PUBLIC_REGISTER_ROLES = [
  ROLES.BUYER,
  ROLES.SELLER,
  ROLES.BROKER,
];

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

const ALL_ROLES = [...PUBLIC_REGISTER_ROLES, ...ADMIN_ROLES];

function isPublicRegisterRole(role) {
  return PUBLIC_REGISTER_ROLES.includes(role);
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

module.exports = {
  ROLES,
  PUBLIC_REGISTER_ROLES,
  ADMIN_ROLES,
  ALL_ROLES,
  isPublicRegisterRole,
  isAdminRole,
  isValidRole,
};
