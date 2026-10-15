import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Analytics: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type RootParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
};