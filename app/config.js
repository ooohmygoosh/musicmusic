import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};
const envBase = process.env.EXPO_PUBLIC_API_BASE;

const DEV_API_BASE = "http://10.0.2.2:8080";
const PROD_API_BASE = "https://api.ooooooo0hmygooooooo0sh.xyz/api";

export const API_BASE = envBase || extra.apiBase || (__DEV__ ? DEV_API_BASE : PROD_API_BASE);
