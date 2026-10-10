import type { CapacitorConfig } from '@capacitor/cli'

// تكوين التطبيق الأصلي — يُبنى من نفس كود الويب (Android + iOS)
const config: CapacitorConfig = {
  appId: 'dz.riayati.vitalink',
  appName: 'Vital DZ',
  webDir: 'dist',
  backgroundColor: '#F7F6FB',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    scheme: 'VitalinkDZ',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
    },
  },
}

export default config