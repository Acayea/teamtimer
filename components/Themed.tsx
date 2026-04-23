/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */

import { Text as DefaultText, View as DefaultView } from 'react-native';

import Colors from '../constants/Colors';
import { useColorScheme } from './useColorScheme';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const themeProps: { light?: string; dark?: string } = {};
  if (lightColor !== undefined) themeProps.light = lightColor;
  if (darkColor !== undefined) themeProps.dark = darkColor;
  const color = useThemeColor(themeProps, 'text');

  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const themeProps: { light?: string; dark?: string } = {};
  if (lightColor !== undefined) themeProps.light = lightColor;
  if (darkColor !== undefined) themeProps.dark = darkColor;
  const backgroundColor = useThemeColor(themeProps, 'background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
