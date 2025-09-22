// import i18n from "i18next";
// import { initReactI18next } from "react-i18next";
// import en from "./locales/en.json";
// import hi from "./locales/hi.json";

// i18n
//   .use(initReactI18next)
//   .init({
//     resources: {
//       en: { translation: en },
//       hi: { translation: hi },
//     },
//     lng: "en", // default language
//     fallbackLng: "en",
//     interpolation: { escapeValue: false },
//   });

// export default i18n;


import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";
import ta from "./locales/ta.json";
import kn from "./locales/kn.json";
import bn from "./locales/bn.json";
import gu from "./locales/gu.json";
import te from "./locales/te.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
      ta: { translation: ta },
      kn: { translation: kn },
      bn: { translation: bn },
      gu: { translation: gu },
      te: { translation: te },
    },
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;