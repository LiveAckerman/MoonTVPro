import {
  type LucideIcon,
  Blend,
  Cat,
  Clover,
  Container,
  Film,
  Globe,
  Home,
  Search,
  Star,
  Tv,
  TvMinimalPlay,
  Users,
} from 'lucide-react';

export interface NavigationItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

export interface RuntimeNavigationConfig {
  LIVE_ENABLED?: boolean;
  WEB_LIVE_ENABLED?: boolean;
  PRIVATE_LIBRARY_ENABLED?: boolean;
  ADVANCED_RECOMMENDATION_ENABLED?: boolean;
  CUSTOM_CATEGORIES?: unknown[];
}

export const HOME_NAV_ITEM: NavigationItem = {
  icon: Home,
  label: '首页',
  href: '/',
};

export const SEARCH_NAV_ITEM: NavigationItem = {
  icon: Search,
  label: '搜索',
  href: '/search',
};

const BASE_FEATURE_ITEMS: NavigationItem[] = [
  { icon: Film, label: '电影', href: '/douban?type=movie' },
  { icon: Tv, label: '剧集', href: '/douban?type=tv' },
  { icon: Cat, label: '动漫', href: '/douban?type=anime' },
  { icon: Clover, label: '综艺', href: '/douban?type=show' },
];

export function buildFeatureNavigationItems(
  runtimeConfig?: RuntimeNavigationConfig,
  watchRoomEnabled = false
): NavigationItem[] {
  const items = [...BASE_FEATURE_ITEMS];

  if (runtimeConfig?.LIVE_ENABLED) {
    items.push({ icon: TvMinimalPlay, label: '电视直播', href: '/live' });
  }

  if (runtimeConfig?.WEB_LIVE_ENABLED) {
    items.push({ icon: Globe, label: '网络直播', href: '/web-live' });
  }

  if (runtimeConfig?.PRIVATE_LIBRARY_ENABLED) {
    items.push({
      icon: Container,
      label: '私人影库',
      href: '/private-library',
    });
  }

  if (runtimeConfig?.ADVANCED_RECOMMENDATION_ENABLED) {
    items.push({
      icon: Blend,
      label: '高级推荐',
      href: '/advanced-recommendation',
    });
  }

  if (watchRoomEnabled) {
    items.push({ icon: Users, label: '观影室', href: '/watch-room' });
  }

  if (runtimeConfig?.CUSTOM_CATEGORIES?.length) {
    items.push({ icon: Star, label: '自定义', href: '/douban?type=custom' });
  }

  return items;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isNavigationItemActive(
  currentPath: string,
  itemHref: string
): boolean {
  const decodedActive = safeDecode(currentPath);
  const decodedHref = safeDecode(itemHref);
  const activePathname = decodedActive.split('?')[0];
  const itemPathname = decodedHref.split('?')[0];
  const typeMatch = decodedHref.match(/(?:\?|&)type=([^&]+)/)?.[1];

  if (decodedHref === '/') {
    return activePathname === '/';
  }

  if (typeMatch) {
    return (
      activePathname === '/douban' &&
      decodedActive.includes(`type=${typeMatch}`)
    );
  }

  return activePathname === itemPathname;
}
