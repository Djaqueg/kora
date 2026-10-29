/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenRequest {
  prompt?: string;
  hint?: string;
  login_hint?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (opts?: GoogleTokenRequest) => void;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { type?: string; message?: string }) => void;
}

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
        };
      };
    };
  }
}

export {};
