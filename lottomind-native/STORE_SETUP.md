# LottoMind Store Setup

## App Identity

- App name: `LottoMind`
- Apple bundle ID: `com.lottomind.app`
- Android application ID: `com.lottomind.app`
- Initial version: `1.0` (`1`)
- iOS minimum: 15.0
- Android minimum: API 24
- Android target: API 36

## RevenueCat

Current RevenueCat project configuration:

- Google app: `LottoMind` (`com.lottomind.app`)
- Test Store product: `lottomind_pro_monthly` at `$9.99` monthly
- Entitlement: `pro`
- Current Offering: `default`
- Monthly package: `$rc_monthly`

The native config currently has `useTestStore` enabled so the iOS and Android
wrappers can exercise the complete purchase flow before live store credentials
are available.

Before a production store build:

1. Confirm the RevenueCat account email.
2. Add the Apple app and its In-App Purchase key.
3. Upload Google Play service account credentials.
4. Create matching subscription products in App Store Connect and Google Play Console.
5. Import those products into RevenueCat and attach them to `pro`.
6. Add the live products to the `$rc_monthly` package in `default`.
7. Add the Apple public SDK key and set `useTestStore` to `false` in:

   `../lotto mind refined/revenuecat-native-config.json`

Only RevenueCat public SDK keys belong in this file. Never add store credentials
or private keys.

## Build

```powershell
npm.cmd install
npm.cmd run sync
npm.cmd run open:android
npm.cmd run open:ios
```

Android builds require Android Studio, JDK, and the Android SDK. iOS signing,
StoreKit capability checks, archive creation, and App Store upload require
Xcode on macOS.

Never commit signing keys, keystores, App Store private keys, Google service
account credentials, RevenueCat secret keys, or Stripe secret keys.
