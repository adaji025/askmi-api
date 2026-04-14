export interface InstagramProfile {
  id: string;
  username?: string;
  account_type?: string;
}

interface InstagramErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

interface TokenExchangeResponse {
  access_token?: string;
  user_id?: number | string;
  error_type?: string;
  error_message?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

export class InstagramService {
  private readonly graphApiBaseUrl: string;

  constructor() {
    this.graphApiBaseUrl = process.env.INSTAGRAM_GRAPH_API_URL || 'https://graph.instagram.com';
  }

  /**
   * Exchange authorization code for a short-lived user access token (server-side).
   * Requires INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, and INSTAGRAM_REDIRECT_URI
   * (redirect_uri must match the value used in the authorize step exactly).
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Instagram OAuth is not configured (set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET)');
    }

    const tokenUrl =
      process.env.INSTAGRAM_OAUTH_TOKEN_URL || 'https://api.instagram.com/oauth/access_token';

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const data = (await response.json()) as TokenExchangeResponse;

    if (!response.ok) {
      const msg =
        data.error_message ||
        data.error_type ||
        data.error?.message ||
        'Instagram authorization code exchange failed';
      throw new Error(`INSTAGRAM_OAUTH_ERROR: ${msg}`);
    }

    if (!data.access_token) {
      throw new Error('INSTAGRAM_OAUTH_ERROR: token exchange returned no access_token');
    }

    return data.access_token;
  }

  async getProfile(accessToken: string): Promise<InstagramProfile> {
    const profileUrl = new URL('/me', this.graphApiBaseUrl);
    profileUrl.searchParams.set('fields', 'id,username,account_type');
    profileUrl.searchParams.set('access_token', accessToken);

    const response = await fetch(profileUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to validate Instagram token';
      try {
        const errorBody = (await response.json()) as InstagramErrorResponse;
        if (errorBody.error?.message) {
          errorMessage = errorBody.error.message;
        }
      } catch {
        // Ignore parsing error and return default message
      }
      throw new Error(`INSTAGRAM_OAUTH_ERROR: ${errorMessage}`);
    }

    const data = (await response.json()) as InstagramProfile;
    if (!data.id) {
      throw new Error('INSTAGRAM_OAUTH_ERROR: invalid Instagram profile response');
    }

    return data;
  }
}

export const instagramService = new InstagramService();
