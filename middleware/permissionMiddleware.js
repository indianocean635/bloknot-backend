const { prisma } = require('../services/prismaService');

const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'];

async function hasPermission(userId, permissionKey) {
  const permission = await prisma.userPermission.findFirst({
    where: {
      userId,
      permission: { key: permissionKey }
    }
  });
  return !!permission;
}

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // SUPER_ADMIN always has access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const ok = await hasPermission(req.user.id, permissionKey);
    if (!ok) {
      console.warn('[SECURITY] Missing permission', { userId: req.user.id, permissionKey });
      return res.status(403).json({ error: 'Forbidden - missing permission: ' + permissionKey });
    }

    next();
  };
}

function requireOneOfPermissions(permissionKeys) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    for (const key of permissionKeys) {
      const ok = await hasPermission(req.user.id, key);
      if (ok) return next();
    }

    console.warn('[SECURITY] Missing any permission', { userId: req.user.id, permissionKeys });
    return res.status(403).json({ error: 'Forbidden - missing permissions' });
  };
}

module.exports = {
  requirePermission,
  requireOneOfPermissions,
  hasPermission
};
