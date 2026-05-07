import type { ReactElement } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

type AppIconSVGProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

const iconSource = require('../../assets/branding/icon-v4.png');

export function AppIconSVG({ size = 100, style }: AppIconSVGProps): ReactElement {
  return (
    <Image
      source={iconSource}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}

export default AppIconSVG;
