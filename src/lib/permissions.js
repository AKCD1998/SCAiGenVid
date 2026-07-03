// Client-side mirror of the backend's role permission map. This is purely
// for UX (hiding/showing buttons) — the server is the real enforcement
// point for every one of these actions.
export const ROLE_PERMISSIONS = {
  admin: [
    "content.video.create",
    "content.video.view",
    "content.video.download",
    "content.video.approve",
    "content.video.reject",
    "content.video.retry",
    "content.video.admin",
  ],
  staff: [
    "content.video.create",
    "content.video.view",
    "content.video.download",
    "content.video.retry",
  ],
  branch: ["content.video.view"],
};

export function can(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
