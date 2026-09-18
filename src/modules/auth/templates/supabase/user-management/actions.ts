'use server';

import * as userService from './service';
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  UpdateProfileInput,
  UserManagementResult,
  UserProfile,
} from './types';

/**
 * actions.ts — the module's single public server-side API. Anything a
 * Server Component or a form needs from user management goes through here.
 */

export async function getCurrentUserProfile(): Promise<UserManagementResult<UserProfile>> {
  return userService.getProfile();
}

export async function updateProfileAction(
  input: UpdateProfileInput
): Promise<UserManagementResult<UserProfile>> {
  return userService.updateProfile(input);
}

export async function updateNameAction(name: string): Promise<UserManagementResult<UserProfile>> {
  return userService.updateName(name);
}

export async function updateAvatarAction(
  avatarUrl: string
): Promise<UserManagementResult<UserProfile>> {
  return userService.updateAvatar(avatarUrl);
}

export async function updateMetadataAction(
  metadata: Record<string, unknown>
): Promise<UserManagementResult<UserProfile>> {
  return userService.updateMetadata(metadata);
}

export async function updatePreferencesAction(
  preferences: Record<string, unknown>
): Promise<UserManagementResult<UserProfile>> {
  return userService.updatePreferences(preferences);
}

export async function changeEmailAction(
  input: ChangeEmailInput
): Promise<UserManagementResult<null>> {
  return userService.changeEmail(input);
}

export async function changePasswordAction(
  input: ChangePasswordInput
): Promise<UserManagementResult<null>> {
  return userService.changePassword(input);
}

export async function deleteOwnAccountAction(): Promise<UserManagementResult<null>> {
  return userService.deleteOwnAccount();
}

/**
 * Uploads the file to Storage and persists the resulting URL to the
 * profile's metadata in one step. Expects a `FormData` with a File under
 * the `avatar` key (e.g. from a form's `<input type="file" name="avatar">`).
 */
export async function uploadAvatarAction(
  formData: FormData
): Promise<UserManagementResult<UserProfile>> {
  const file = formData.get('avatar');

  if (!(file instanceof File)) {
    return { data: null, error: { code: 'upload_failed', message: 'No se recibió ningún archivo.' } };
  }

  const uploadResult = await userService.uploadAvatar(file);

  if (uploadResult.error) {
    return { data: null, error: uploadResult.error };
  }

  return userService.updateAvatar(uploadResult.data.url);
}
