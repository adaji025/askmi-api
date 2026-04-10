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

export class InstagramService {
  private readonly graphApiBaseUrl: string;

  constructor() {
    this.graphApiBaseUrl = process.env.INSTAGRAM_GRAPH_API_URL || 'https://graph.instagram.com';
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
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as InstagramProfile;
    if (!data.id) {
      throw new Error('Invalid Instagram profile response');
    }

    return data;
  }
}

export const instagramService = new InstagramService();
