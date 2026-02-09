/**
 * Staging environment configuration
 * Used for Cloud Development Convex deployment
 */

interface EnvironmentConfig {
  production: boolean;
  enableDevLogin: boolean;
  convexUrl: string;
  discordClientId: string;
  discordClientSecret: string;
}

export const environment: EnvironmentConfig = {
  production: false,
  enableDevLogin: false,
  convexUrl: 'https://effervescent-possum-890.convex.cloud',
  discordClientId: '1462225909867221227',
  discordClientSecret: '_eHd2NggNcZuGNy9YUSQ3_YVCGbbW3gh'
};
