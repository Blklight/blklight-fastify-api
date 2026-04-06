import { env } from './env';
import { AppError } from '../utils/errors';

export const features = {
  email: env.FEATURE_EMAIL,
  oauth: env.FEATURE_OAUTH,
  emailQueue: env.FEATURE_EMAIL_QUEUE,
  codeSandbox: env.FEATURE_CODE_SANDBOX,
} as const;

export type FeatureName = keyof typeof features;

export function requireFeature(feature: FeatureName): void {
  if (!features[feature]) {
    throw new AppError(
      'FEATURE_DISABLED',
      'This feature is currently unavailable.',
      503
    );
  }
}
