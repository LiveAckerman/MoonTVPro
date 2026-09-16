export {};

declare global {
  interface Window {
    RUNTIME_CONFIG?: {
      RecommendationDataSource?: string;
      [key: string]: unknown;
    };
  }
}
