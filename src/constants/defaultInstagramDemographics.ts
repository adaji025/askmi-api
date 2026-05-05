import type { Prisma } from '@prisma/client';

/** Default audience breakdown for new influencers; API may return this when DB value is null. */
export const DEFAULT_INSTAGRAM_DEMOGRAPHICS = {
  ageRange: [
    { label: '25 - 34', percentage: 100 },
  ],
  language: [
    { label: 'English', percentage: 100 },
  ],
  gender: [
    { label: 'Female', percentage: 100 },
  ],
  primaryLocation: [
    { countryCode: 'IL', countryName: 'Israel', percentage: 100 },
  ],
} as const;

export function defaultInstagramDemographicsAsJson(): Prisma.InputJsonValue {
  return DEFAULT_INSTAGRAM_DEMOGRAPHICS as unknown as Prisma.InputJsonValue;
}
