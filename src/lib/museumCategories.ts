export const CANONICAL_MUSEUM_CATEGORIES = [
  'Contemporary Art',
  'Modern Art',
  'Fine Arts',
  'Art Gallery',
  'Design Museum',
  'Architecture Museum',
  'Photography Museum',
  'History Museum',
  'Archaeological Museum',
  'Natural History',
  'Science Museum',
  'Maritime Museum',
  'Cultural Center',
  'Unusual Museum',
  'General Museum',
] as const;

export type MuseumCategory = (typeof CANONICAL_MUSEUM_CATEGORIES)[number];

export const MUSEUM_CATEGORY_FILTERS = ['All', ...CANONICAL_MUSEUM_CATEGORIES] as const;

const CATEGORY_ICON_SLUGS: Record<string, string> = {
  All: 'all',
  'Contemporary Art': 'contemporary-art',
  'Modern Art': 'modern-art',
  'Fine Arts': 'fine-arts',
  'Art Gallery': 'art-gallery',
  'Design Museum': 'design-museum',
  'Architecture Museum': 'architecture-museum',
  'Photography Museum': 'photography-museum',
  'History Museum': 'history-museum',
  'Archaeological Museum': 'archaeological-museum',
  'Natural History': 'natural-history',
  'Science Museum': 'science-museum',
  'Maritime Museum': 'maritime-museum',
  'Cultural Center': 'cultural-center',
  'Unusual Museum': 'unusual-museum',
  'General Museum': 'general-museum',
};

export const MUSEUM_CATEGORY_ICON_PATHS = Object.fromEntries(
  Object.entries(CATEGORY_ICON_SLUGS).map(([category, slug]) => [category, `/category-icons/${slug}.svg`])
) as Record<string, string>;

export function getMuseumCategoryIconSrc(category: string) {
  return MUSEUM_CATEGORY_ICON_PATHS[category] || MUSEUM_CATEGORY_ICON_PATHS['General Museum'];
}
