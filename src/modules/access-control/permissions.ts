// Permission catalogue and built-in roles. Pure module — safe to import anywhere.

export const PERMISSIONS = {
  JOB_VIEW_ALL: "job.view_all",
  JOB_CREATE: "job.create",
  JOB_EDIT: "job.edit",
  JOB_PUBLISH: "job.publish",
  JOB_CLOSE: "job.close",
  CANDIDATE_VIEW: "candidate.view",
  CANDIDATE_ADD: "candidate.add",
  CANDIDATE_EDIT: "candidate.edit",
  APPLICATION_VIEW: "application.view",
  APPLICATION_CREATE: "application.create",
  APPLICATION_UPDATE_STATUS: "application.update_status",
  APPLICATION_ASSIGN: "application.assign",
  APPLICATION_NOTE: "application.note",
  CASE_FILE_VIEW: "case_file.view",
  DOCUMENT_VIEW: "document.view",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  ROLE_DELETE: "role.delete",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "job.view_all": "See all jobs (otherwise only jobs they created or are assigned to)",
  "job.create": "Create jobs",
  "job.edit": "Edit job details and the assigned recruiter",
  "job.publish": "Publish and re-open jobs",
  "job.close": "Close, archive and unarchive jobs",
  "candidate.view": "View candidates and use advanced search",
  "candidate.add": "Add internal candidates",
  "candidate.edit": "Edit candidate profiles and their documents",
  "application.view": "View applications",
  "application.create": "Add existing candidates to jobs",
  "application.update_status": "Change application status",
  "application.assign": "Assign a recruiter to an application",
  "application.note": "Add internal notes to applications",
  "case_file.view": "Open job case files and application folders",
  "document.view": "Open and download resumes and documents",
  "user.manage": "Create, edit and deactivate staff users",
  "role.manage": "Create and edit roles",
  "role.delete": "Delete custom roles",
};

/** Permission groups shown on the role form. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Jobs", permissions: ["job.view_all", "job.create", "job.edit", "job.publish", "job.close"] },
  { label: "Candidates", permissions: ["candidate.view", "candidate.add", "candidate.edit"] },
  { label: "Applications", permissions: ["application.view", "application.create", "application.update_status", "application.assign", "application.note"] },
  { label: "Case files & documents", permissions: ["case_file.view", "document.view"] },
  { label: "Administration", permissions: ["user.manage", "role.manage", "role.delete"] },
];

export const SYSTEM_ROLE_KEYS = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  RECRUITER: "RECRUITER",
} as const;

export type SystemRoleKey = keyof typeof SYSTEM_ROLE_KEYS;

const P = PERMISSIONS;

export const SYSTEM_ROLES: Record<SystemRoleKey, { name: string; description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Complete access, including staff users and roles.",
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: "Admin",
    description: "Manages jobs, candidates, applications and case files.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== P.USER_MANAGE && p !== P.ROLE_MANAGE && p !== P.ROLE_DELETE),
  },
  RECRUITER: {
    name: "Recruiter",
    description: "Works on their jobs: searches and adds candidates, reviews applications.",
    permissions: [
      P.CANDIDATE_VIEW, P.CANDIDATE_ADD, P.CANDIDATE_EDIT,
      P.APPLICATION_VIEW, P.APPLICATION_CREATE, P.APPLICATION_UPDATE_STATUS, P.APPLICATION_ASSIGN, P.APPLICATION_NOTE,
      P.CASE_FILE_VIEW, P.DOCUMENT_VIEW,
    ],
  },
};

/** Roles with these keys cannot be edited or deleted from the UI. */
export const LOCKED_ROLE_KEYS: string[] = [SYSTEM_ROLE_KEYS.SUPER_ADMIN];

export function resolvePermissions(rolePermissionCodes: string[][]): Set<Permission> {
  const known = new Set<string>(ALL_PERMISSIONS);
  return new Set(rolePermissionCodes.flat().filter((code): code is Permission => known.has(code)));
}
