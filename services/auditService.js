const { prisma } = require('./prismaService');

async function logAdminAction({ adminId, action, entity, entityId, metadata }) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId: entityId || null,
        metadata: metadata || {}
      }
    });
  } catch (error) {
    console.error('[AUDIT] Failed to write audit log:', error);
  }
}

module.exports = {
  logAdminAction
};
