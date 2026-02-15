export interface StyleConfig {
  backgroundColor: string;
  deviceFramePadding: number;
  textPosition: 'top' | 'bottom';
  textColor: string;
  titleSize: number;
  subtitleSize: number;
  textPadding: number;
}

export const minimalStyle: StyleConfig = {
  backgroundColor: '#FFFFFF',
  deviceFramePadding: 60,
  textPosition: 'bottom',
  textColor: '#000000',
  titleSize: 48,
  subtitleSize: 24,
  textPadding: 40,
};
