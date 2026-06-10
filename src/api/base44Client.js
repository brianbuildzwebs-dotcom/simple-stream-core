import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const createEntityStub = () => ({
  list: async () => [],
  subscribe: () => () => {},
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => true,
});

const createAuthStub = () => ({
  me: async () => null,
  setToken: () => {},
  logout: () => {},
  redirectToLogin: () => {},
  loginViaEmailPassword: async () => ({}),
  loginWithProvider: () => {},
  register: async () => ({}),
  verifyOtp: async () => ({ access_token: '' }),
  resendOtp: async () => ({}),
  resetPasswordRequest: async () => ({}),
  resetPassword: async () => ({}),
});

const createClient = () => ({
  appId,
  token,
  functionsVersion,
  appBaseUrl,
  auth: createAuthStub(),
  entities: new Proxy({}, {
    get() {
      return createEntityStub();
    },
  }),
});

export const base44 = createClient();
