"use server";

import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  listPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission,
  assignPermissionToRole,
  removePermissionFromRole,
  getUserRole,
  getUserPermissions,
  assignRoleToUser,
  removeRoleFromUser,
  checkRole,
  checkPermission,
} from "./service";
import type { AuthResult, Role, Permission, OrgRole } from "./types";

// ---------- Roles ----------

export async function listRolesAction(): Promise<AuthResult<Role[]>> {
  const roles = await listRoles();
  return { success: true, data: roles };
}

export async function getRoleAction(
  roleId: string
): Promise<AuthResult<Role>> {
  try {
    const role = await getRole(roleId);
    return { success: true, data: role };
  } catch {
    return { success: false, error: "Role not found" };
  }
}

export async function createRoleAction(params: {
  name: string;
  key: string;
  description?: string;
}): Promise<AuthResult<Role>> {
  try {
    const role = await createRole(params);
    return { success: true, data: role };
  } catch {
    return { success: false, error: "Could not create the role" };
  }
}

export async function updateRoleAction(
  roleId: string,
  data: { name?: string; description?: string }
): Promise<AuthResult<Role>> {
  try {
    const role = await updateRole(roleId, data);
    return { success: true, data: role };
  } catch {
    return { success: false, error: "Could not update the role" };
  }
}

export async function deleteRoleAction(
  roleId: string
): Promise<AuthResult> {
  try {
    await deleteRole(roleId);
    return { success: true, data: undefined };
  } catch {
    return {
      success: false,
      error: "Could not delete the role (check it's not a Creator/Default role or still assigned to members)",
    };
  }
}

export async function getRolePermissionsAction(
  roleId: string
): Promise<AuthResult<Permission[]>> {
  const permissions = await getRolePermissions(roleId);
  return { success: true, data: permissions };
}

// ---------- Permissions ----------

export async function listPermissionsAction(): Promise<
  AuthResult<Permission[]>
> {
  const permissions = await listPermissions();
  return { success: true, data: permissions };
}

export async function getPermissionAction(
  permissionId: string
): Promise<AuthResult<Permission>> {
  try {
    const permission = await getPermission(permissionId);
    return { success: true, data: permission };
  } catch {
    return { success: false, error: "Permission not found" };
  }
}

export async function createPermissionAction(params: {
  name: string;
  key: string;
  description?: string;
}): Promise<AuthResult<Permission>> {
  try {
    const permission = await createPermission(params);
    return { success: true, data: permission };
  } catch {
    return {
      success: false,
      error: "Could not create the permission (check its Feature exists)",
    };
  }
}

export async function updatePermissionAction(
  permissionId: string,
  data: { name?: string; description?: string }
): Promise<AuthResult<Permission>> {
  try {
    const permission = await updatePermission(permissionId, data);
    return { success: true, data: permission };
  } catch {
    return { success: false, error: "Could not update the permission" };
  }
}

export async function deletePermissionAction(
  permissionId: string
): Promise<AuthResult> {
  try {
    await deletePermission(permissionId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not delete the permission" };
  }
}

export async function assignPermissionToRoleAction(
  roleId: string,
  permissionId: string
): Promise<AuthResult> {
  try {
    await assignPermissionToRole(roleId, permissionId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not assign the permission" };
  }
}

export async function removePermissionFromRoleAction(
  roleId: string,
  permissionId: string
): Promise<AuthResult> {
  try {
    await removePermissionFromRole(roleId, permissionId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not remove the permission" };
  }
}

// ---------- User ↔ role/permission ----------

export async function getUserRoleAction(
  organizationId: string,
  userId: string
): Promise<AuthResult<OrgRole>> {
  const role = await getUserRole(organizationId, userId);
  if (!role) return { success: false, error: "User has no role in this organization" };
  return { success: true, data: role };
}

export async function getUserPermissionsAction(
  organizationId: string,
  userId: string
): Promise<AuthResult<Permission[]>> {
  const permissions = await getUserPermissions(organizationId, userId);
  return { success: true, data: permissions };
}

export async function assignRoleToUserAction(
  organizationId: string,
  userId: string,
  role: OrgRole
): Promise<AuthResult> {
  try {
    await assignRoleToUser(organizationId, userId, role);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not assign the role" };
  }
}

export async function removeRoleFromUserAction(
  organizationId: string,
  userId: string
): Promise<AuthResult> {
  try {
    await removeRoleFromUser(organizationId, userId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Could not remove the role" };
  }
}

// ---------- Checks ----------

export async function checkRoleAction(
  role: OrgRole
): Promise<AuthResult<boolean>> {
  const ok = await checkRole(role);
  return { success: true, data: ok };
}

export async function checkPermissionAction(
  permission: string
): Promise<AuthResult<boolean>> {
  const ok = await checkPermission(permission);
  return { success: true, data: ok };
}
