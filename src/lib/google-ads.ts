import { GoogleAdsApi } from 'google-ads-api';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN || '';

if (!CLIENT_ID || !CLIENT_SECRET || !DEVELOPER_TOKEN) {
  console.warn('Google Ads API credentials are missing in environment variables.');
}

export const googleAdsClient = new GoogleAdsApi({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  developer_token: DEVELOPER_TOKEN,
});

export const getGoogleAuthUrl = (redirectUri: string) => {
  const scope = 'https://www.googleapis.com/auth/adwords';
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
};
