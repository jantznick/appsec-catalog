import { prisma } from '../prisma/client.js';
import { createApplicationVersion } from './applicationVersion.js';

/**
 * Parse a stored `interfaces` JSON column into an array of application IDs.
 * Returns [] for null, malformed JSON, or a non-array payload — the callers
 * treat all three the same way: "this app has no usable interface list".
 */
function parseInterfaceIds(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Keep the `interfaces` field symmetric: when app A lists app B, app B must list
 * app A back. Editing A therefore writes B, and that write is a real metadata
 * change on B — so each counterpart we actually modify gets its own version
 * snapshot, otherwise B's history would silently skip the change.
 *
 * Best-effort by design: a failure here is logged and swallowed so it cannot
 * fail the caller's request, matching the behaviour this replaced.
 *
 * @param {Object} params
 * @param {string} params.currentAppId - The app being edited (added to / removed from counterparts)
 * @param {string[]} params.nextInterfaceIds - Apps that should list currentAppId
 * @param {string[]} params.previousInterfaceIds - Apps that listed it before; any not in
 *   nextInterfaceIds have currentAppId removed. Pass [] to only add.
 * @param {string|null} params.userId - User to attribute the counterpart versions to
 * @param {string} params.changeSource - changeSource for the counterpart versions
 */
export async function syncReciprocalInterfaces({
  currentAppId,
  nextInterfaceIds = [],
  previousInterfaceIds = [],
  userId = null,
  changeSource = 'interface_link',
}) {
  try {
    for (const interfaceAppId of nextInterfaceIds) {
      const interfaceApp = await prisma.application.findUnique({
        where: { id: interfaceAppId },
        select: { id: true, interfaces: true },
      });
      if (!interfaceApp) continue;

      const existing = parseInterfaceIds(interfaceApp.interfaces);
      if (existing.includes(currentAppId)) continue;

      await prisma.application.update({
        where: { id: interfaceAppId },
        data: { interfaces: JSON.stringify([...existing, currentAppId]) },
      });
      await createApplicationVersion(interfaceAppId, userId, changeSource);
    }

    const removedIds = previousInterfaceIds.filter((id) => !nextInterfaceIds.includes(id));
    for (const removedId of removedIds) {
      const removedApp = await prisma.application.findUnique({
        where: { id: removedId },
        select: { id: true, interfaces: true },
      });
      if (!removedApp) continue;

      const existing = parseInterfaceIds(removedApp.interfaces);
      if (!existing.includes(currentAppId)) continue;

      const remaining = existing.filter((id) => id !== currentAppId);
      await prisma.application.update({
        where: { id: removedId },
        data: { interfaces: remaining.length > 0 ? JSON.stringify(remaining) : null },
      });
      await createApplicationVersion(removedId, userId, changeSource);
    }
  } catch (error) {
    console.error('Error updating reciprocal interfaces:', error);
  }
}

export { parseInterfaceIds };
