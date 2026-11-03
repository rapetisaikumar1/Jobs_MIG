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
  APPLICATION_UPDATE_STATUS: "application.update_status",
  CASE_FILE_VIEW: "case_file.view",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "job.view_all": "View all jobs (otherwise only jobs assigned to the user or their groups)",
  "job.create": "Create jobs",
  "job.edit": "Edit jobs",
  "job.publish": "Publish jobs",
  "job.close": "Close and archive jobs",
  "candidate.view": "View and search candidates",
  "candidate.add": "Add candidates and add candidates to jobs",
  "candidate.edit": "Edit candidates and their documents",
  "application.view": "View applications",
  "application.update_status": "Update application status, assignment and notes",
  "case_file.view": "View case files",
  "user.manage": "Manage staff users",
  "role.manage": "Manage roles and groups",
};

export const SYSTEM_ROLE_KEYS = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  RECRUITER: "RECRUITER",
  CANDIDATE: "CANDIDATE",
} as const;

export type SystemRoleKey = keyof typeof SYSTEM_ROLE_KEYS;

const P = PERMISSIONS;

export const SYSTEM_ROLES: Record<SystemRoleKey, { name: string; description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Complete access, including staff users, roles and groups.",
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: "Admin",
    description: "Manages jobs, candidates, applications and case files.",
    permissions: [
      P.JOB_VIEW_ALL, P.JOB_CREATE, P.JOB_EDIT, P.JOB_PUBLISH, P.JOB_CLOSE,
      P.CANDIDATE_VIEW, P.CANDIDATE_ADD, P.CANDIDATE_EDIT,
      P.APPLICATION_VIEW, P.APPLICATION_UPDATE_STATUS, P.CASE_FILE_VIEW,
    ],
  },
  RECRUITER: {
    name: "Recruiter",
    description: "Works on authorized jobs: searches and adds candidates, reviews applications.",
    permissions: [
      P.CANDIDATE_VIEW, P.CANDIDATE_ADD, P.CANDIDATE_EDIT,
      P.APPLICATION_VIEW, P.APPLICATION_UPDATE_STATUS, P.CASE_FILE_VIEW,
    ],
  },
  CANDIDATE: {
    name: "Candidate",
    description: "Job portal account: manages own profile and applications. Not assignable to staff.",
    permissions: [],
  },
};

/** Roles with these keys cannot be edited or deleted from the UI. */
export const LOCKED_ROLE_KEYS: string[] = [SYSTEM_ROLE_KEYS.SUPER_ADMIN, SYSTEM_ROLE_KEYS.CANDIDATE];

export function resolvePermissions(rolePermissionCodes: string[][]): Set<Permission> {
  const known = new Set<string>(ALL_PERMISSIONS);
  return new Set(rolePermissionCodes.flat().filter((code): code is Permission => known.has(code)));
}
