export const ROLE_LIST = [
  "Administrator",
  "Field Collection",
  "Processing",
  "Packaging",
  "Labeling",
] as const;

export type Role = (typeof ROLE_LIST)[number];

export const ALLOWED_ROLES = new Set<string>(ROLE_LIST);

const ROLE_SYNONYMS: Record<string, Role> = {
  labelling: "Labeling",
};

const ROLE_LOOKUP = new Map<string, Role>(
  ROLE_LIST.map((role) => [role.toLowerCase(), role])
);

for (const [alias, canonical] of Object.entries(ROLE_SYNONYMS)) {
  ROLE_LOOKUP.set(alias.toLowerCase(), canonical);
}

export const DEFAULT_ROLE: Role = "Field Collection";

const SELF_SERVICE_ROLE_SET = new Set<Role>([DEFAULT_ROLE]);

export function normalizeRole(role?: string | null): Role | undefined {
  if (!role) return undefined;
  return ROLE_LOOKUP.get(role.toLowerCase());
}

export function isAllowedRole(role: string): role is Role {
  return ALLOWED_ROLES.has(role);
}

export function isSelfServiceRole(role: Role) {
  return SELF_SERVICE_ROLE_SET.has(role);
}

export function getRoleSynonyms() {
  return { ...ROLE_SYNONYMS };
}
