import { Platform } from 'react-native';
import { BACKEND_URL } from './config';

export type TeamFile = {
  id: string;
  path: string;
  displayName: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  created: string;
};

/** Upload a file for a team */
export async function uploadTeamFile(
  uri: string,
  filename: string,
  mimeType: string,
  teamId: string
): Promise<TeamFile> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    // On web, fetch the blob URI to get real file bytes, then wrap in a File object
    const blobRes = await fetch(uri);
    const blob = await blobRes.blob();
    const file = new File([blob], filename, { type: mimeType });
    formData.append('file', file);
  } else {
    // React Native: pass the { uri, type, name } object — RN's fetch handles it
    formData.append('file', { uri, type: mimeType, name: filename } as any);
  }
  formData.append('filename', filename);

  const response = await fetch(`${BACKEND_URL}/api/team-files/upload/${teamId}`, {
    method: 'POST',
    body: formData,
  });

  const responseText = await response.text();
  let data: { data?: TeamFile; error?: string };
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error('[uploadTeamFile] Non-JSON response:', responseText.slice(0, 200));
    throw new Error('Upload failed: server returned an unexpected response. Please try again.');
  }
  if (!response.ok || data.error) {
    throw new Error(data.error ?? 'Upload failed');
  }
  return data.data!;
}

/** List all files for a team */
export async function fetchTeamFiles(teamId: string): Promise<TeamFile[]> {
  const response = await fetch(`${BACKEND_URL}/api/team-files/${teamId}`);
  const data = (await response.json()) as { data?: TeamFile[]; error?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error ?? 'Failed to fetch files');
  }
  return data.data ?? [];
}

/** Delete a file by its storage path */
export async function deleteTeamFile(filePath: string): Promise<void> {
  const response = await fetch(
    `${BACKEND_URL}/api/team-files/delete?path=${encodeURIComponent(filePath)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Delete failed');
  }
}

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a short label for a MIME type */
export function fileTypeLabel(contentType: string): string {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType.startsWith('image/')) return 'Image';
  if (
    contentType === 'application/msword' ||
    contentType.includes('wordprocessingml')
  )
    return 'Word';
  if (
    contentType === 'application/vnd.ms-excel' ||
    contentType.includes('spreadsheetml')
  )
    return 'Excel';
  if (contentType === 'text/plain') return 'Text';
  if (contentType === 'text/csv') return 'CSV';
  return 'File';
}
