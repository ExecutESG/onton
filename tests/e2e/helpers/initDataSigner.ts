import * as crypto from 'crypto';

export function signTelegramInitData(userData: { id: number, first_name?: string, username?: string }, botToken: string): string {
  const data = {
    auth_date: Math.floor(Date.now() / 1000).toString(),
    query_id: 'mock_query_id_' + Date.now(),
    user: JSON.stringify({
      id: userData.id,
      first_name: userData.first_name || 'E2E User',
      username: userData.username || 'e2e_user',
      language_code: 'en',
    })
  };

  const dataCheckString = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const initData = new URLSearchParams(data);
  initData.append('hash', hash);

  return initData.toString();
}
