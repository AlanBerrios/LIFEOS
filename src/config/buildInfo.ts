import Constants from 'expo-constants';

export interface BuildMetadata {
  appVersion: string;
  commitHash: string;
  buildTimestamp: string;
}

type ExpoExtra = {
  buildMetadata?: Partial<BuildMetadata>;
};

function readExpoExtra(): Partial<BuildMetadata> {
  return (Constants.expoConfig?.extra as ExpoExtra | undefined)?.buildMetadata ?? {};
}

export function getBuildMetadata(): BuildMetadata {
  const extra = readExpoExtra();

  return {
    appVersion: Constants.expoConfig?.version ?? 'dev',
    commitHash: extra.commitHash ?? 'local',
    buildTimestamp: extra.buildTimestamp ?? 'unknown'
  };
}