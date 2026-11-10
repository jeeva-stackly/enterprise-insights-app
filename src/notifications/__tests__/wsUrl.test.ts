import { describe, expect, it } from '@jest/globals';

import { toNotificationsSocketUrl } from '../wsUrl';

describe('toNotificationsSocketUrl', () => {
  it('turns http into ws and https into wss', () => {
    expect(toNotificationsSocketUrl('http://192.168.1.3:8000')).toBe('ws://192.168.1.3:8000/ws/notifications');
    expect(toNotificationsSocketUrl('https://api.example.com')).toBe('wss://api.example.com/ws/notifications');
  });

  it('ignores a trailing slash', () => {
    expect(toNotificationsSocketUrl('http://10.0.2.2:8000/')).toBe('ws://10.0.2.2:8000/ws/notifications');
  });
});