import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '전시 | Museum Map',
    description: 'Museum Map에서 현재 진행 중이거나 예정된 공식 전시를 지역별로 살펴보세요.',
    alternates: {
        canonical: 'https://museummap.app/exhibitions',
    },
};

export default function ExhibitionsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
