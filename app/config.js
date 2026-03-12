import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};
const envBase = process.env.EXPO_PUBLIC_API_BASE;

export const API_BASE = envBase || extra.apiBase || "http://10.0.2.2:8080";
