import { defineConfig } from "wxt";

export default defineConfig({
  suppressWarnings: { firefoxDataCollection: true },
  manifest: {
    name: "__MSG_appName__",
    description: "__MSG_appDesc__",
    default_locale: "en",
    icons: {
      16: "/icon/wishlephant-16.png",
      32: "/icon/wishlephant-32.png",
      48: "/icon/wishlephant-48.png",
      96: "/icon/wishlephant-96.png",
      128: "/icon/wishlephant-128.png",
    },
    permissions: ["activeTab", "scripting"],
    host_permissions: ["https://*/*", "http://*/*"],
    action: {
      default_icon: {
        16: "/icon/wishlephant-16.png",
        32: "/icon/wishlephant-32.png",
        48: "/icon/wishlephant-48.png",
        96: "/icon/wishlephant-96.png",
        128: "/icon/wishlephant-128.png",
      },
    },
    browser_specific_settings: {
      gecko: {
        id: "{5edc9e95-13ed-42b7-9598-ce7f242d3cbd}",
        strict_min_version: "109.0",
      },
    },
  },
});
