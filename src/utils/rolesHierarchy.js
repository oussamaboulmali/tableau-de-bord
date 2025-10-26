// 1) Enum‑like constant: numbers are the hierarchy levels.
// Object.freeze makes it immutable at runtime.
export const roleHierarchy = Object.freeze({
  Rédacteur: 1,
  Infographe: 1,
  Vidéaste: 1,
  Photographe: 1,

  "Chef de vacation": 2,

  "Rédacteur en chef": 3,
  Superviseur: 3,

  Admin: 4,

  SuperUser: 5,
});

/**
 * Gets the hierarchy level of one role.
 * @param {string|number} role – role name in roleHierarchy **or** its numeric value
 * @returns {number} level (0 if unknown)
 */
export const getRoleLevel = (role) => {
  if (typeof role === "number") return role; // already a level
  return roleHierarchy[role] ?? 0; // look up in enum‑like map
};

/**
 * Returns the highest role level in an array.
 * @param {Array<string|number>} roles
 * @returns {number}
 */
export const getHighestRoleLevel = (roles) => {
  if (!Array.isArray(roles)) return 0;

  return roles.reduce((max, r) => {
    const lvl = getRoleLevel(r);
    return lvl > max ? lvl : max;
  }, 0);
};

/**
 * Can a user manage a target role?
 * A user must have *strictly higher* authority.
 * @param {Array<string|number>} userRoles
 * @param {string|number}        targetRole
 * @returns {boolean}
 */
export const canManageRole = (userRoles, targetRole) => {
  return getHighestRoleLevel(userRoles) > getRoleLevel(targetRole);
};
