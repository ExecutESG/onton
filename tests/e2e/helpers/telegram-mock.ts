import { Page } from "@playwright/test";

export interface MockTelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  role?: "user" | "organizer" | "admin" | "ban";
}

export async function injectTelegramMock(page: Page, user: MockTelegramUser = {}) {
  const defaultUser = {
    id: user.id || 987654321,
    first_name: user.first_name || "Onton",
    last_name: user.last_name || "GrowthTester",
    username: user.username || "ontontester",
    language_code: user.language_code || "en",
    is_premium: true,
  };

  const initDataStr = `user=${encodeURIComponent(JSON.stringify(defaultUser))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=e2e_mock_hash_verification`;

  await page.addInitScript((mockData) => {
    // @ts-ignore
    window.Telegram = {
      WebApp: {
        initData: mockData.initDataStr,
        initDataUnsafe: {
          user: mockData.defaultUser,
          auth_date: Math.floor(Date.now() / 1000),
          hash: "e2e_mock_hash_verification",
          start_param: "growth_e2e_campaign",
        },
        version: "7.10",
        platform: "tdesktop",
        colorScheme: "dark",
        themeParams: {
          bg_color: "#18222d",
          text_color: "#ffffff",
          hint_color: "#b1c3d5",
          link_color: "#62bcf9",
          button_color: "#2ea6ff",
          button_text_color: "#ffffff",
          secondary_bg_color: "#131415",
        },
        isExpanded: true,
        viewportHeight: 844,
        viewportStableHeight: 844,
        headerColor: "#18222d",
        backgroundColor: "#18222d",
        BackButton: {
          isVisible: false,
          show: () => {},
          hide: () => {},
          onClick: () => {},
          offClick: () => {},
        },
        MainButton: {
          text: "CONTINUE",
          color: "#2ea6ff",
          textColor: "#ffffff",
          isVisible: false,
          isActive: true,
          isProgressVisible: false,
          setText: () => {},
          onClick: () => {},
          offClick: () => {},
          show: () => {},
          hide: () => {},
          enable: () => {},
          disable: () => {},
          showProgress: () => {},
          hideProgress: () => {},
        },
        HapticFeedback: {
          impactOccurred: () => {},
          notificationOccurred: () => {},
          selectionChanged: () => {},
        },
        isVersionAtLeast: (_v: string) => true,
        ready: () => {},
        expand: () => {},
        close: () => {},
        onEvent: (_eventType: string, _eventHandler: Function) => {},
        offEvent: (_eventType: string, _eventHandler: Function) => {},
        sendData: (_data: string) => {},
        showPopup: (_params: any, cb?: () => void) => { if (cb) cb(); },
        showAlert: (_msg: string, cb?: () => void) => { if (cb) cb(); },
        showConfirm: (_msg: string, cb?: (val: boolean) => void) => { if (cb) cb(true); },
        openLink: (_url: string) => {},
        openTelegramLink: (_url: string) => {},
        setHeaderColor: () => {},
        setBackgroundColor: () => {},
        enableClosingConfirmation: () => {},
        disableClosingConfirmation: () => {},
      },
    };
  }, { defaultUser, initDataStr });
}
