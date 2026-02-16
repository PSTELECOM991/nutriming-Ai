
/**
 * Google Drive API Service
 * Handles OAuth2 authentication and file operations for backups.
 */

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Placeholder: Requires a real client ID from Google Console
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'InventoryMaster_Backup.json';

let tokenClient: any = null;
let accessToken: string | null = null;

export const initDriveClient = () => {
  return new Promise<void>((resolve, reject) => {
    if (!(window as any).gapi) return reject('GAPI not loaded');
    
    (window as any).gapi.load('client', async () => {
      try {
        await (window as any).gapi.client.init({});
        await (window as any).gapi.client.load('drive', 'v3');
        
        tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse.error !== undefined) {
              reject(tokenResponse);
            }
            accessToken = tokenResponse.access_token;
            resolve();
          },
        });
        
        // If we have a cached token in memory, we might be able to resolve
        if (accessToken) resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

export const authenticateDrive = () => {
  return new Promise<string>((resolve, reject) => {
    if (!tokenClient) return reject('Token client not initialized');
    
    tokenClient.callback = (resp: any) => {
      if (resp.error) return reject(resp);
      accessToken = resp.access_token;
      resolve(resp.access_token);
    };
    
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

export const findBackupFile = async () => {
  const response = await (window as any).gapi.client.drive.files.list({
    q: `name = '${BACKUP_FILENAME}' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return response.result.files[0] || null;
};

export const uploadToDrive = async (data: any) => {
  const existingFile = await findBackupFile();
  const fileId = existingFile?.id;
  
  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: 'application/json',
  };

  const fileContent = JSON.stringify(data);
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    close_delim;

  const path = fileId 
    ? `/upload/drive/v3/files/${fileId}?uploadType=multipart` 
    : '/upload/drive/v3/files?uploadType=multipart';
  
  const method = fileId ? 'PATCH' : 'POST';

  return (window as any).gapi.client.request({
    path: path,
    method: method,
    params: { uploadType: 'multipart' },
    headers: {
      'Content-Type': 'multipart/related; boundary="' + boundary + '"',
    },
    body: multipartRequestBody,
  });
};

export const downloadFromDrive = async () => {
  const existingFile = await findBackupFile();
  if (!existingFile) throw new Error('No backup file found on Drive');

  const response = await (window as any).gapi.client.drive.files.get({
    fileId: existingFile.id,
    alt: 'media',
  });
  
  return response.result;
};
