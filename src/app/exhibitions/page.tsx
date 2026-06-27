'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Clock3, ExternalLink, Search, SearchX, Shuffle, X } from 'lucide-react';
import { useApp } from '@/components/AppContext';
import type { Locale } from '@/lib/locale-core';
import { getCountryName } from '@/lib/countries';
import { getLocalizedCityName, getLocalizedExhibitionTitle, getLocalizedMuseumName } from '@/lib/getLocalizedName';
import { getMuseumImageSrc, isRenderableUrl } from '@/lib/getMuseumImage';
import { lockMobileSearchChrome, primeMobileSearchChrome } from '@/lib/mobileSearchChrome';
import styles from './exhibitions.module.css';

type ContinentKey = 'ALL' | 'ASIA' | 'EUROPE' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA' | 'AFRICA';

type ExhibitionMuseum = {
    id: string;
    name: string;
    nameKo?: string | null;
    nameEn?: string | null;
    nameTranslations?: Record<string, string> | null;
    city?: string | null;
    cityKo?: string | null;
    cityTranslations?: Record<string, string> | null;
    country?: string | null;
    type?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
    cachedPhotoUrls?: unknown;
};

type ExhibitionItem = {
    id: string;
    museumId: string;
    title: string;
    titleTranslations?: Record<string, string> | null;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    createdAt?: string | null;
    imageUrl?: string | null;
    link?: string | null;
    source?: string | null;
    museum?: ExhibitionMuseum | null;
};

type ExhibitionViewItem = ExhibitionItem & {
    continent: ContinentKey | null;
    daysUntilEnd: number | null;
    daysUntilStart: number | null;
};

type ExhibitionSortMode = 'random' | 'endingSoon' | 'startingSoon' | 'distance';

type ScheduleKind = 'start' | 'end' | 'ongoing';

type WeekCalendarLabels = {
    title: string;
    subtitle: string;
    today: string;
    start: string;
    end: string;
    ongoing: string;
    noItems: string;
    empty: string;
    activeCount: (count: number) => string;
    moreCount: (count: number) => string;
};

type WeekScheduleEntry = {
    exhibition: ExhibitionViewItem;
    kind: ScheduleKind;
};

type WeekDaySchedule = {
    dateOnly: string;
    entries: WeekScheduleEntry[];
    previewEntries: WeekScheduleEntry[];
    hiddenCount: number;
    activeCount: number;
    isToday: boolean;
};

type PageLabels = {
    kicker: string;
    title: string;
    subtitle: string;
    question: string;
    endingSoon: string;
    startingSoon: string;
    allList: string;
    loading: string;
    emptyAll: string;
    emptyFiltered?: string;
    emptyBody?: string;
    emptyQuestion?: string;
    emptySoon?: string;
    emptyStartingSoon?: string;
    error: string;
    retry: string;
    count: string;
    period: string;
    venue: string;
    official: string;
    openLink: string;
    ongoing: string;
    upcoming: string;
    endedToday: string;
    endsIn: (days: number) => string;
    startsToday: string;
    startsIn: (days: number) => string;
    shuffle?: string;
    previous?: string;
    next?: string;
    regionLabel: string;
    regions: Record<ContinentKey, string>;
};

type ExhibitionSearchLabels = {
    placeholder: string;
    results: string;
    empty: string;
    clear: string;
    scope: string;
};

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
        updatePreference();
        mediaQuery.addEventListener?.('change', updatePreference);
        return () => mediaQuery.removeEventListener?.('change', updatePreference);
    }, []);

    return prefersReducedMotion;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXHIBITION_LIST_PER_PAGE = 10;
const EXHIBITION_RANDOM_SEED_KEY = 'mm-exhibition-list-random-seed-v1';

const SORT_LABELS: Record<ExhibitionSortMode, Record<string, string>> = {
    random: {
        ko: '랜덤순', en: 'Random', ja: 'ランダム', de: 'Zufällig', fr: 'Aléatoire', es: 'Aleatorio', pt: 'Aleatório',
        'zh-CN': '随机', 'zh-TW': '隨機', da: 'Tilfældig', fi: 'Satunnainen', sv: 'Slumpvis', et: 'Juhuslik',
    },
    endingSoon: {
        ko: '전시 마감순', en: 'Ending soon', ja: '終了が近い順', de: 'Endet bald', fr: 'Fin proche', es: 'Terminan pronto', pt: 'Terminam em breve',
        'zh-CN': '即将结束', 'zh-TW': '即將結束', da: 'Slutter snart', fi: 'Päättyy pian', sv: 'Slutar snart', et: 'Lõpeb varsti',
    },
    startingSoon: {
        ko: '전시 임박일', en: 'Opening soon', ja: '開幕が近い順', de: 'Beginnt bald', fr: 'Début proche', es: 'Comienzan pronto', pt: 'Começam em breve',
        'zh-CN': '即将开始', 'zh-TW': '即將開始', da: 'Starter snart', fi: 'Alkaa pian', sv: 'Börjar snart', et: 'Algab varsti',
    },
    distance: {
        ko: '거리순', en: 'Nearest', ja: '距離順', de: 'Entfernung', fr: 'Distance', es: 'Distancia', pt: 'Distância',
        'zh-CN': '距离', 'zh-TW': '距離', da: 'Afstand', fi: 'Etäisyys', sv: 'Avstånd', et: 'Kaugus',
    },
};

const EXHIBITION_SEARCH_LABELS: Record<string, ExhibitionSearchLabels> = {
    ko: {
        placeholder: '전시, 미술관, 도시 검색',
        results: '검색 결과',
        empty: '맞는 전시가 없어요.',
        clear: '검색어 지우기',
        scope: '검색',
    },
    en: {
        placeholder: 'Search exhibitions, museums, cities',
        results: 'Search results',
        empty: 'No matching exhibitions.',
        clear: 'Clear search',
        scope: 'Search',
    },
    ja: {
        placeholder: '展覧会・美術館・都市を検索',
        results: '検索結果',
        empty: '一致する展覧会はありません。',
        clear: '検索語を消去',
        scope: '検索',
    },
    de: {
        placeholder: 'Ausstellungen, Museen, Städte suchen',
        results: 'Suchergebnisse',
        empty: 'Keine passenden Ausstellungen.',
        clear: 'Suche löschen',
        scope: 'Suche',
    },
    fr: {
        placeholder: 'Rechercher expositions, musées, villes',
        results: 'Résultats',
        empty: 'Aucune exposition correspondante.',
        clear: 'Effacer la recherche',
        scope: 'Recherche',
    },
    es: {
        placeholder: 'Buscar exposiciones, museos, ciudades',
        results: 'Resultados',
        empty: 'No hay exposiciones coincidentes.',
        clear: 'Borrar búsqueda',
        scope: 'Búsqueda',
    },
    pt: {
        placeholder: 'Pesquisar exposições, museus, cidades',
        results: 'Resultados',
        empty: 'Nenhuma exposição correspondente.',
        clear: 'Limpar pesquisa',
        scope: 'Pesquisa',
    },
    'zh-CN': {
        placeholder: '搜索展览、博物馆、城市',
        results: '搜索结果',
        empty: '没有匹配的展览。',
        clear: '清除搜索',
        scope: '搜索',
    },
    'zh-TW': {
        placeholder: '搜尋展覽、博物館、城市',
        results: '搜尋結果',
        empty: '沒有符合的展覽。',
        clear: '清除搜尋',
        scope: '搜尋',
    },
    da: {
        placeholder: 'Søg udstillinger, museer, byer',
        results: 'Søgeresultater',
        empty: 'Ingen matchende udstillinger.',
        clear: 'Ryd søgning',
        scope: 'Søgning',
    },
    fi: {
        placeholder: 'Hae näyttelyitä, museoita, kaupunkeja',
        results: 'Hakutulokset',
        empty: 'Ei vastaavia näyttelyitä.',
        clear: 'Tyhjennä haku',
        scope: 'Haku',
    },
    sv: {
        placeholder: 'Sök utställningar, museer, städer',
        results: 'Sökresultat',
        empty: 'Inga matchande utställningar.',
        clear: 'Rensa sökning',
        scope: 'Sökning',
    },
    et: {
        placeholder: 'Otsi näitusi, muuseume, linnu',
        results: 'Otsingutulemused',
        empty: 'Sobivaid näitusi ei leitud.',
        clear: 'Tühjenda otsing',
        scope: 'Otsing',
    },
};

const WEEK_CALENDAR_LABELS: Record<string, WeekCalendarLabels> = {
    ko: {
        title: '이번주 전시 스케줄',
        subtitle: '시작, 종료, 진행 중인 전시를 날짜별로 확인해보세요.',
        today: '오늘',
        start: '시작',
        end: '종료 임박',
        ongoing: '전시 중',
        noItems: '일정 없음',
        empty: '이번 주에 표시할 전시 일정이 없어요.',
        activeCount: (count) => `${count}개 진행`,
        moreCount: (count) => `+${count}개 더`,
    },
    en: {
        title: 'This week',
        subtitle: 'See openings, closings, and on-view exhibitions by day.',
        today: 'Today',
        start: 'Starts',
        end: 'Ends',
        ongoing: 'On view',
        noItems: 'No schedule',
        empty: 'No exhibition schedule this week.',
        activeCount: (count) => `${count} on view`,
        moreCount: (count) => `+${count} more`,
    },
    ja: {
        title: '今週の展覧会予定',
        subtitle: '開始・終了・開催中の展覧会を日別に確認できます。',
        today: '今日',
        start: '開始',
        end: '終了',
        ongoing: '開催中',
        noItems: '予定なし',
        empty: '今週表示できる展覧会予定はありません。',
        activeCount: (count) => `${count}件開催中`,
        moreCount: (count) => `+${count}件`,
    },
    de: {
        title: 'Diese Woche',
        subtitle: 'Eröffnungen, Enddaten und laufende Ausstellungen nach Tag.',
        today: 'Heute',
        start: 'Start',
        end: 'Ende',
        ongoing: 'Läuft',
        noItems: 'Kein Termin',
        empty: 'Für diese Woche gibt es keine Ausstellungsplanung.',
        activeCount: (count) => `${count} laufend`,
        moreCount: (count) => `+${count} mehr`,
    },
    fr: {
        title: 'Cette semaine',
        subtitle: 'Ouvertures, fins et expositions en cours par jour.',
        today: 'Aujourd’hui',
        start: 'Début',
        end: 'Fin',
        ongoing: 'En cours',
        noItems: 'Aucun programme',
        empty: 'Aucun programme d’exposition cette semaine.',
        activeCount: (count) => `${count} en cours`,
        moreCount: (count) => `+${count} autres`,
    },
    es: {
        title: 'Esta semana',
        subtitle: 'Aperturas, cierres y exposiciones en curso por día.',
        today: 'Hoy',
        start: 'Inicio',
        end: 'Cierre',
        ongoing: 'En curso',
        noItems: 'Sin agenda',
        empty: 'No hay agenda de exposiciones esta semana.',
        activeCount: (count) => `${count} en curso`,
        moreCount: (count) => `+${count} más`,
    },
    pt: {
        title: 'Esta semana',
        subtitle: 'Aberturas, encerramentos e exposições em cartaz por dia.',
        today: 'Hoje',
        start: 'Início',
        end: 'Fim',
        ongoing: 'Em cartaz',
        noItems: 'Sem agenda',
        empty: 'Não há agenda de exposições nesta semana.',
        activeCount: (count) => `${count} em cartaz`,
        moreCount: (count) => `+${count} mais`,
    },
    'zh-CN': {
        title: '本周展览日程',
        subtitle: '按日期查看开幕、结束和正在展出的展览。',
        today: '今天',
        start: '开始',
        end: '结束',
        ongoing: '展出中',
        noItems: '暂无日程',
        empty: '本周暂无可显示的展览日程。',
        activeCount: (count) => `${count}个展出中`,
        moreCount: (count) => `+${count}个`,
    },
    'zh-TW': {
        title: '本週展覽日程',
        subtitle: '按日期查看開幕、結束與展出中的展覽。',
        today: '今天',
        start: '開始',
        end: '結束',
        ongoing: '展出中',
        noItems: '暫無日程',
        empty: '本週暫無可顯示的展覽日程。',
        activeCount: (count) => `${count}個展出中`,
        moreCount: (count) => `+${count}個`,
    },
    da: {
        title: 'Denne uge',
        subtitle: 'Se åbninger, afslutninger og aktuelle udstillinger pr. dag.',
        today: 'I dag',
        start: 'Starter',
        end: 'Slutter',
        ongoing: 'Vises',
        noItems: 'Ingen plan',
        empty: 'Der er ingen udstillingsplan denne uge.',
        activeCount: (count) => `${count} vises`,
        moreCount: (count) => `+${count} mere`,
    },
    fi: {
        title: 'Tämä viikko',
        subtitle: 'Katso avaukset, päättymiset ja esillä olevat näyttelyt päivittäin.',
        today: 'Tänään',
        start: 'Alkaa',
        end: 'Päättyy',
        ongoing: 'Esillä',
        noItems: 'Ei aikataulua',
        empty: 'Tälle viikolle ei ole näyttelyaikataulua.',
        activeCount: (count) => `${count} esillä`,
        moreCount: (count) => `+${count} lisää`,
    },
    sv: {
        title: 'Denna vecka',
        subtitle: 'Se öppningar, avslut och pågående utställningar per dag.',
        today: 'I dag',
        start: 'Startar',
        end: 'Slutar',
        ongoing: 'Visas',
        noItems: 'Inget schema',
        empty: 'Det finns inget utställningsschema den här veckan.',
        activeCount: (count) => `${count} visas`,
        moreCount: (count) => `+${count} till`,
    },
    et: {
        title: 'Sel nädalal',
        subtitle: 'Vaata avamisi, lõppe ja käimasolevaid näitusi päevade kaupa.',
        today: 'Täna',
        start: 'Algab',
        end: 'Lõpeb',
        ongoing: 'Avatud',
        noItems: 'Ajakava pole',
        empty: 'Selle nädala näitusekava puudub.',
        activeCount: (count) => `${count} avatud`,
        moreCount: (count) => `+${count} veel`,
    },
};

const PAGE_LABELS: Record<string, PageLabels> = {
    ko: {
        kicker: 'EXHIBITIONS',
        title: '전시',
        subtitle: '지금 볼 수 있거나 곧 열리는 공식 기획전 정보를 지역별로 살펴보세요.',
        question: '이 전시 어때요?',
        endingSoon: '곧 종료될 전시',
        startingSoon: '곧 시작될 전시',
        allList: '전체 전시 목록',
        loading: '전시를 불러오는 중이에요',
        emptyAll: '아직 등록된 전시가 없어요.',
        emptyFiltered: '선택한 지역의 전시는 아직 없어요.',
        emptyBody: '새 전시가 추가되면 이곳에서 지역별로 바로 볼 수 있어요.',
        emptyQuestion: '추천할 전시가 아직 없어요.',
        emptySoon: '종료까지 20일 이내인 전시는 없어요.',
        emptyStartingSoon: '20일 이내 시작하는 전시는 없어요.',
        error: '전시 목록을 불러오지 못했어요.',
        retry: '다시 불러오기',
        count: '개',
        period: '전시 기간',
        venue: '전시 장소',
        official: '공식 확인',
        openLink: '공식 페이지',
        ongoing: '전시 중',
        upcoming: '전시 예정',
        endedToday: '오늘 종료',
        endsIn: (days) => `종료 D-${days}`,
        startsToday: '오늘 시작',
        startsIn: (days) => `시작 D-${days}`,
        shuffle: '랜덤으로 다시 보기',
        previous: '이전 전시',
        next: '다음 전시',
        regionLabel: '지역',
        regions: { ALL: '전체', ASIA: '아시아', EUROPE: '유럽', NORTH_AMERICA: '북미', SOUTH_AMERICA: '남미', OCEANIA: '오세아니아', AFRICA: '아프리카' },
    },
    en: {
        kicker: 'EXHIBITIONS',
        title: 'Exhibitions',
        subtitle: 'Browse official current and upcoming special exhibitions by region.',
        question: 'How about these?',
        endingSoon: 'Ending soon',
        startingSoon: 'Starting soon',
        allList: 'All exhibitions',
        loading: 'Loading exhibitions',
        emptyAll: 'No exhibitions are listed yet.',
        emptyFiltered: 'No exhibitions in this region yet.',
        emptyBody: 'New exhibitions will appear here by region as they are added.',
        emptyQuestion: 'No exhibitions to recommend yet.',
        emptySoon: 'No exhibitions end within 20 days.',
        emptyStartingSoon: 'No exhibitions start within 20 days.',
        error: 'Could not load exhibitions.',
        retry: 'Try again',
        count: 'shows',
        period: 'Dates',
        venue: 'Venue',
        official: 'Official',
        openLink: 'Open',
        ongoing: 'On view',
        upcoming: 'Upcoming',
        endedToday: 'Ends today',
        endsIn: (days) => `Ends in ${days}d`,
        startsToday: 'Starts today',
        startsIn: (days) => `Starts in ${days}d`,
        shuffle: 'Shuffle exhibitions',
        previous: 'Previous exhibition',
        next: 'Next exhibition',
        regionLabel: 'Region',
        regions: { ALL: 'All', ASIA: 'Asia', EUROPE: 'Europe', NORTH_AMERICA: 'North America', SOUTH_AMERICA: 'South America', OCEANIA: 'Oceania', AFRICA: 'Africa' },
    },
    ja: {
        kicker: 'EXHIBITIONS',
        title: '展覧会',
        subtitle: '開催中・近日開催の公式企画展を地域別に見られます。',
        question: 'この展覧会はいかがですか？',
        endingSoon: 'まもなく終了',
        startingSoon: 'まもなく開始',
        allList: '展覧会一覧',
        loading: '展覧会を読み込み中',
        emptyAll: '登録された展覧会はまだありません。',
        emptyFiltered: 'この地域の展覧会はまだありません。',
        emptyBody: '新しい展覧会が追加されると、ここで地域別に確認できます。',
        emptyQuestion: 'おすすめできる展覧会はまだありません。',
        emptySoon: '20日以内に終了する展覧会はありません。',
        emptyStartingSoon: '20日以内に始まる展覧会はありません。',
        error: '展覧会を読み込めませんでした。',
        retry: '再読み込み',
        count: '件',
        period: '会期',
        venue: '会場',
        official: '公式確認',
        openLink: '開く',
        ongoing: '開催中',
        upcoming: '開催予定',
        endedToday: '本日終了',
        endsIn: (days) => `終了まで${days}日`,
        startsToday: '本日開始',
        startsIn: (days) => `開始まで${days}日`,
        shuffle: 'ランダムに並べ替え',
        previous: '前の展覧会',
        next: '次の展覧会',
        regionLabel: '地域',
        regions: { ALL: 'すべて', ASIA: 'アジア', EUROPE: 'ヨーロッパ', NORTH_AMERICA: '北米', SOUTH_AMERICA: '南米', OCEANIA: 'オセアニア', AFRICA: 'アフリカ' },
    },
    de: {
        kicker: 'EXHIBITIONS',
        title: 'Ausstellungen',
        subtitle: 'Aktuelle und kommende offizielle Sonderausstellungen nach Region.',
        question: 'Wie wäre es mit diesen?',
        endingSoon: 'Endet bald',
        startingSoon: 'Beginnt bald',
        allList: 'Alle Ausstellungen',
        loading: 'Ausstellungen werden geladen',
        emptyAll: 'Noch keine Ausstellungen gelistet.',
        emptyFiltered: 'In dieser Region gibt es noch keine Ausstellungen.',
        emptyBody: 'Neue Ausstellungen erscheinen hier nach Region, sobald sie ergänzt werden.',
        emptyQuestion: 'Noch keine Ausstellungen zum Empfehlen.',
        emptySoon: 'Keine Ausstellung endet innerhalb von 20 Tagen.',
        emptyStartingSoon: 'Keine Ausstellung beginnt innerhalb von 20 Tagen.',
        error: 'Ausstellungen konnten nicht geladen werden.',
        retry: 'Erneut laden',
        count: 'Ausstellungen',
        period: 'Zeitraum',
        venue: 'Ort',
        official: 'Offiziell',
        openLink: 'Öffnen',
        ongoing: 'Läuft',
        upcoming: 'Demnächst',
        endedToday: 'Endet heute',
        endsIn: (days) => `Endet in ${days} T.`,
        startsToday: 'Beginnt heute',
        startsIn: (days) => `Startet in ${days} T.`,
        shuffle: 'Ausstellungen mischen',
        previous: 'Vorherige Ausstellung',
        next: 'Nächste Ausstellung',
        regionLabel: 'Region',
        regions: { ALL: 'Alle', ASIA: 'Asien', EUROPE: 'Europa', NORTH_AMERICA: 'Nordamerika', SOUTH_AMERICA: 'Südamerika', OCEANIA: 'Ozeanien', AFRICA: 'Afrika' },
    },
    fr: {
        kicker: 'EXHIBITIONS',
        title: 'Expositions',
        subtitle: 'Parcourez les expositions temporaires officielles en cours ou à venir par région.',
        question: 'Et ces expositions ?',
        endingSoon: 'Bientôt terminées',
        startingSoon: 'Bientôt ouvertes',
        allList: 'Toutes les expositions',
        loading: 'Chargement des expositions',
        emptyAll: 'Aucune exposition répertoriée pour le moment.',
        emptyFiltered: 'Aucune exposition dans cette région pour le moment.',
        emptyBody: 'Les nouvelles expositions apparaîtront ici par région dès leur ajout.',
        emptyQuestion: 'Aucune exposition à recommander pour le moment.',
        emptySoon: 'Aucune exposition ne se termine dans les 20 jours.',
        emptyStartingSoon: 'Aucune exposition ne commence dans les 20 jours.',
        error: 'Impossible de charger les expositions.',
        retry: 'Réessayer',
        count: 'expositions',
        period: 'Dates',
        venue: 'Lieu',
        official: 'Officiel',
        openLink: 'Ouvrir',
        ongoing: 'En cours',
        upcoming: 'À venir',
        endedToday: 'Se termine aujourd’hui',
        endsIn: (days) => `Se termine dans ${days} j`,
        startsToday: 'Commence aujourd’hui',
        startsIn: (days) => `Commence dans ${days} j`,
        shuffle: 'Mélanger les expositions',
        previous: 'Exposition précédente',
        next: 'Exposition suivante',
        regionLabel: 'Région',
        regions: { ALL: 'Tout', ASIA: 'Asie', EUROPE: 'Europe', NORTH_AMERICA: 'Amérique du Nord', SOUTH_AMERICA: 'Amérique du Sud', OCEANIA: 'Océanie', AFRICA: 'Afrique' },
    },
    es: {
        kicker: 'EXHIBITIONS',
        title: 'Exposiciones',
        subtitle: 'Explora exposiciones temporales oficiales actuales y próximas por región.',
        question: '¿Qué tal estas?',
        endingSoon: 'Terminan pronto',
        startingSoon: 'Empiezan pronto',
        allList: 'Todas las exposiciones',
        loading: 'Cargando exposiciones',
        emptyAll: 'Aún no hay exposiciones registradas.',
        emptyFiltered: 'Aún no hay exposiciones en esta región.',
        emptyBody: 'Las nuevas exposiciones aparecerán aquí por región cuando se agreguen.',
        emptyQuestion: 'Aún no hay exposiciones para recomendar.',
        emptySoon: 'No hay exposiciones que terminen dentro de 20 días.',
        emptyStartingSoon: 'No hay exposiciones que empiecen dentro de 20 días.',
        error: 'No se pudieron cargar las exposiciones.',
        retry: 'Volver a intentar',
        count: 'exposiciones',
        period: 'Fechas',
        venue: 'Lugar',
        official: 'Oficial',
        openLink: 'Abrir',
        ongoing: 'En curso',
        upcoming: 'Próxima',
        endedToday: 'Termina hoy',
        endsIn: (days) => `Termina en ${days} d`,
        startsToday: 'Empieza hoy',
        startsIn: (days) => `Empieza en ${days} d`,
        shuffle: 'Mezclar exposiciones',
        previous: 'Exposición anterior',
        next: 'Siguiente exposición',
        regionLabel: 'Región',
        regions: { ALL: 'Todo', ASIA: 'Asia', EUROPE: 'Europa', NORTH_AMERICA: 'Norteamérica', SOUTH_AMERICA: 'Sudamérica', OCEANIA: 'Oceanía', AFRICA: 'África' },
    },
    pt: {
        kicker: 'EXHIBITIONS',
        title: 'Exposições',
        subtitle: 'Veja exposições temporárias oficiais em cartaz ou futuras por região.',
        question: 'Que tal estas?',
        endingSoon: 'Terminando em breve',
        startingSoon: 'Começando em breve',
        allList: 'Todas as exposições',
        loading: 'Carregando exposições',
        emptyAll: 'Ainda não há exposições cadastradas.',
        emptyFiltered: 'Ainda não há exposições nesta região.',
        emptyBody: 'Novas exposições aparecerão aqui por região quando forem adicionadas.',
        emptyQuestion: 'Ainda não há exposições para recomendar.',
        emptySoon: 'Nenhuma exposição termina dentro de 20 dias.',
        emptyStartingSoon: 'Nenhuma exposição começa dentro de 20 dias.',
        error: 'Não foi possível carregar as exposições.',
        retry: 'Tentar novamente',
        count: 'exposições',
        period: 'Datas',
        venue: 'Local',
        official: 'Oficial',
        openLink: 'Abrir',
        ongoing: 'Em cartaz',
        upcoming: 'Em breve',
        endedToday: 'Termina hoje',
        endsIn: (days) => `Termina em ${days} d`,
        startsToday: 'Começa hoje',
        startsIn: (days) => `Começa em ${days} d`,
        shuffle: 'Embaralhar exposições',
        previous: 'Exposição anterior',
        next: 'Próxima exposição',
        regionLabel: 'Região',
        regions: { ALL: 'Tudo', ASIA: 'Ásia', EUROPE: 'Europa', NORTH_AMERICA: 'América do Norte', SOUTH_AMERICA: 'América do Sul', OCEANIA: 'Oceania', AFRICA: 'África' },
    },
    'zh-CN': {
        kicker: 'EXHIBITIONS',
        title: '展览',
        subtitle: '按地区查看正在展出或即将开幕的官方专题展。',
        question: '这些展览怎么样？',
        endingSoon: '即将结束',
        startingSoon: '即将开幕',
        allList: '全部展览',
        loading: '正在加载展览',
        emptyAll: '暂无展览。',
        emptyFiltered: '该地区暂无展览。',
        emptyBody: '新增展览后，你可以在这里按地区查看。',
        emptyQuestion: '暂无可推荐的展览。',
        emptySoon: '20天内没有即将结束的展览。',
        emptyStartingSoon: '20天内没有即将开幕的展览。',
        error: '无法加载展览。',
        retry: '重新加载',
        count: '个',
        period: '展期',
        venue: '展出地点',
        official: '官方确认',
        openLink: '打开',
        ongoing: '展出中',
        upcoming: '即将开幕',
        endedToday: '今天结束',
        endsIn: (days) => `${days}天后结束`,
        startsToday: '今天开始',
        startsIn: (days) => `${days}天后开始`,
        shuffle: '随机查看展览',
        previous: '上一场展览',
        next: '下一场展览',
        regionLabel: '地区',
        regions: { ALL: '全部', ASIA: '亚洲', EUROPE: '欧洲', NORTH_AMERICA: '北美', SOUTH_AMERICA: '南美', OCEANIA: '大洋洲', AFRICA: '非洲' },
    },
    'zh-TW': {
        kicker: 'EXHIBITIONS',
        title: '展覽',
        subtitle: '按地區查看正在展出或即將開幕的官方專題展。',
        question: '這些展覽怎麼樣？',
        endingSoon: '即將結束',
        startingSoon: '即將開幕',
        allList: '全部展覽',
        loading: '正在載入展覽',
        emptyAll: '暫無展覽。',
        emptyFiltered: '該地區暫無展覽。',
        emptyBody: '新增展覽後，你可以在這裡按地區查看。',
        emptyQuestion: '暫無可推薦的展覽。',
        emptySoon: '20天內沒有即將結束的展覽。',
        emptyStartingSoon: '20天內沒有即將開幕的展覽。',
        error: '無法載入展覽。',
        retry: '重新載入',
        count: '個',
        period: '展期',
        venue: '展出地點',
        official: '官方確認',
        openLink: '開啟',
        ongoing: '展出中',
        upcoming: '即將開幕',
        endedToday: '今天結束',
        endsIn: (days) => `${days}天後結束`,
        startsToday: '今天開始',
        startsIn: (days) => `${days}天後開始`,
        shuffle: '隨機查看展覽',
        previous: '上一場展覽',
        next: '下一場展覽',
        regionLabel: '地區',
        regions: { ALL: '全部', ASIA: '亞洲', EUROPE: '歐洲', NORTH_AMERICA: '北美', SOUTH_AMERICA: '南美', OCEANIA: '大洋洲', AFRICA: '非洲' },
    },
    da: {
        kicker: 'EXHIBITIONS',
        title: 'Udstillinger',
        subtitle: 'Se officielle aktuelle og kommende særudstillinger efter region.',
        question: 'Hvad med disse?',
        endingSoon: 'Slutter snart',
        startingSoon: 'Starter snart',
        allList: 'Alle udstillinger',
        loading: 'Indlæser udstillinger',
        emptyAll: 'Der er endnu ingen udstillinger.',
        emptyFiltered: 'Der er endnu ingen udstillinger i denne region.',
        emptyBody: 'Nye udstillinger vises her efter region, når de bliver tilføjet.',
        emptyQuestion: 'Der er endnu ingen udstillinger at anbefale.',
        emptySoon: 'Ingen udstillinger slutter inden for 20 dage.',
        emptyStartingSoon: 'Ingen udstillinger starter inden for 20 dage.',
        error: 'Udstillinger kunne ikke indlæses.',
        retry: 'Prøv igen',
        count: 'udstillinger',
        period: 'Datoer',
        venue: 'Sted',
        official: 'Officiel',
        openLink: 'Åbn',
        ongoing: 'Aktuel',
        upcoming: 'Kommende',
        endedToday: 'Slutter i dag',
        endsIn: (days) => `Slutter om ${days} d`,
        startsToday: 'Starter i dag',
        startsIn: (days) => `Starter om ${days} d`,
        shuffle: 'Bland udstillinger',
        previous: 'Forrige udstilling',
        next: 'Næste udstilling',
        regionLabel: 'Region',
        regions: { ALL: 'Alle', ASIA: 'Asien', EUROPE: 'Europa', NORTH_AMERICA: 'Nordamerika', SOUTH_AMERICA: 'Sydamerika', OCEANIA: 'Oceanien', AFRICA: 'Afrika' },
    },
    fi: {
        kicker: 'EXHIBITIONS',
        title: 'Näyttelyt',
        subtitle: 'Selaa virallisia käynnissä olevia ja tulevia erikoisnäyttelyitä alueittain.',
        question: 'Entä nämä?',
        endingSoon: 'Päättyy pian',
        startingSoon: 'Alkaa pian',
        allList: 'Kaikki näyttelyt',
        loading: 'Ladataan näyttelyitä',
        emptyAll: 'Näyttelyitä ei ole vielä listattu.',
        emptyFiltered: 'Tällä alueella ei ole vielä näyttelyitä.',
        emptyBody: 'Uudet näyttelyt näkyvät täällä alueittain, kun niitä lisätään.',
        emptyQuestion: 'Suositeltavia näyttelyitä ei vielä ole.',
        emptySoon: 'Yksikään näyttely ei pääty 20 päivän sisällä.',
        emptyStartingSoon: 'Yksikään näyttely ei ala 20 päivän sisällä.',
        error: 'Näyttelyitä ei voitu ladata.',
        retry: 'Yritä uudelleen',
        count: 'näyttelyä',
        period: 'Ajankohta',
        venue: 'Paikka',
        official: 'Virallinen',
        openLink: 'Avaa',
        ongoing: 'Käynnissä',
        upcoming: 'Tulossa',
        endedToday: 'Päättyy tänään',
        endsIn: (days) => `Päättyy ${days} pv`,
        startsToday: 'Alkaa tänään',
        startsIn: (days) => `Alkaa ${days} pv`,
        shuffle: 'Sekoita näyttelyt',
        previous: 'Edellinen näyttely',
        next: 'Seuraava näyttely',
        regionLabel: 'Alue',
        regions: { ALL: 'Kaikki', ASIA: 'Aasia', EUROPE: 'Eurooppa', NORTH_AMERICA: 'Pohjois-Amerikka', SOUTH_AMERICA: 'Etelä-Amerikka', OCEANIA: 'Oseania', AFRICA: 'Afrikka' },
    },
    sv: {
        kicker: 'EXHIBITIONS',
        title: 'Utställningar',
        subtitle: 'Bläddra bland officiella pågående och kommande specialutställningar per region.',
        question: 'Vad sägs om dessa?',
        endingSoon: 'Slutar snart',
        startingSoon: 'Startar snart',
        allList: 'Alla utställningar',
        loading: 'Laddar utställningar',
        emptyAll: 'Inga utställningar finns listade än.',
        emptyFiltered: 'Det finns ännu inga utställningar i den här regionen.',
        emptyBody: 'Nya utställningar visas här per region när de läggs till.',
        emptyQuestion: 'Det finns ännu inga utställningar att rekommendera.',
        emptySoon: 'Inga utställningar slutar inom 20 dagar.',
        emptyStartingSoon: 'Inga utställningar startar inom 20 dagar.',
        error: 'Kunde inte ladda utställningar.',
        retry: 'Försök igen',
        count: 'utställningar',
        period: 'Datum',
        venue: 'Plats',
        official: 'Officiell',
        openLink: 'Öppna',
        ongoing: 'Pågår',
        upcoming: 'Kommande',
        endedToday: 'Slutar idag',
        endsIn: (days) => `Slutar om ${days} d`,
        startsToday: 'Startar idag',
        startsIn: (days) => `Startar om ${days} d`,
        shuffle: 'Blanda utställningar',
        previous: 'Föregående utställning',
        next: 'Nästa utställning',
        regionLabel: 'Region',
        regions: { ALL: 'Alla', ASIA: 'Asien', EUROPE: 'Europa', NORTH_AMERICA: 'Nordamerika', SOUTH_AMERICA: 'Sydamerika', OCEANIA: 'Oceanien', AFRICA: 'Afrika' },
    },
    et: {
        kicker: 'EXHIBITIONS',
        title: 'Näitused',
        subtitle: 'Sirvi ametlikke käimasolevaid ja tulevasi erinäitusi piirkonna järgi.',
        question: 'Kuidas oleks nendega?',
        endingSoon: 'Lõppeb varsti',
        startingSoon: 'Algab varsti',
        allList: 'Kõik näitused',
        loading: 'Näituste laadimine',
        emptyAll: 'Näitusi pole veel lisatud.',
        emptyFiltered: 'Selles piirkonnas pole veel näitusi.',
        emptyBody: 'Uued näitused ilmuvad siia piirkonna järgi, kui need lisatakse.',
        emptyQuestion: 'Soovitatavaid näitusi pole veel.',
        emptySoon: 'Ükski näitus ei lõpe 20 päeva jooksul.',
        emptyStartingSoon: 'Ükski näitus ei alga 20 päeva jooksul.',
        error: 'Näitusi ei saanud laadida.',
        retry: 'Proovi uuesti',
        count: 'näitust',
        period: 'Kuupäevad',
        venue: 'Koht',
        official: 'Ametlik',
        openLink: 'Ava',
        ongoing: 'Avatud',
        upcoming: 'Tulekul',
        endedToday: 'Lõpeb täna',
        endsIn: (days) => `Lõpeb ${days} p pärast`,
        startsToday: 'Algab täna',
        startsIn: (days) => `Algab ${days} p pärast`,
        shuffle: 'Sega näitusi',
        previous: 'Eelmine näitus',
        next: 'Järgmine näitus',
        regionLabel: 'Piirkond',
        regions: { ALL: 'Kõik', ASIA: 'Aasia', EUROPE: 'Euroopa', NORTH_AMERICA: 'Põhja-Ameerika', SOUTH_AMERICA: 'Lõuna-Ameerika', OCEANIA: 'Okeaania', AFRICA: 'Aafrika' },
    },
};

const CONTINENT_ORDER: ContinentKey[] = ['ALL', 'ASIA', 'EUROPE', 'NORTH_AMERICA', 'SOUTH_AMERICA', 'OCEANIA', 'AFRICA'];

const REGION_CHIP_COLORS: Record<ContinentKey, { color: string; strong: string; bg: string; border: string; darkBg: string; darkBorder: string }> = {
    ALL: { color: '#2563eb', strong: '#1d4ed8', bg: 'rgba(37, 99, 235, 0.10)', border: 'rgba(37, 99, 235, 0.38)', darkBg: 'rgba(37, 99, 235, 0.16)', darkBorder: 'rgba(96, 165, 250, 0.42)' },
    ASIA: { color: '#1d4ed8', strong: '#1e40af', bg: 'rgba(29, 78, 216, 0.11)', border: 'rgba(29, 78, 216, 0.36)', darkBg: 'rgba(29, 78, 216, 0.18)', darkBorder: 'rgba(96, 165, 250, 0.40)' },
    EUROPE: { color: '#2563eb', strong: '#1d4ed8', bg: 'rgba(37, 99, 235, 0.10)', border: 'rgba(37, 99, 235, 0.36)', darkBg: 'rgba(37, 99, 235, 0.16)', darkBorder: 'rgba(147, 197, 253, 0.38)' },
    NORTH_AMERICA: { color: '#0284c7', strong: '#0369a1', bg: 'rgba(2, 132, 199, 0.11)', border: 'rgba(2, 132, 199, 0.36)', darkBg: 'rgba(2, 132, 199, 0.17)', darkBorder: 'rgba(56, 189, 248, 0.40)' },
    SOUTH_AMERICA: { color: '#0ea5e9', strong: '#0284c7', bg: 'rgba(14, 165, 233, 0.11)', border: 'rgba(14, 165, 233, 0.38)', darkBg: 'rgba(14, 165, 233, 0.16)', darkBorder: 'rgba(125, 211, 252, 0.38)' },
    OCEANIA: { color: '#0369a1', strong: '#075985', bg: 'rgba(3, 105, 161, 0.10)', border: 'rgba(3, 105, 161, 0.34)', darkBg: 'rgba(3, 105, 161, 0.18)', darkBorder: 'rgba(56, 189, 248, 0.36)' },
    AFRICA: { color: '#1e40af', strong: '#1e3a8a', bg: 'rgba(30, 64, 175, 0.10)', border: 'rgba(30, 64, 175, 0.34)', darkBg: 'rgba(30, 64, 175, 0.18)', darkBorder: 'rgba(129, 140, 248, 0.38)' },
};

const CONTINENT_COUNTRIES: Record<Exclude<ContinentKey, 'ALL'>, Set<string>> = {
    ASIA: new Set(['AE', 'AM', 'AZ', 'BH', 'BN', 'BT', 'CN', 'GE', 'HK', 'ID', 'IL', 'IN', 'IQ', 'IR', 'JO', 'JP', 'KH', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LK', 'MM', 'MN', 'MO', 'MY', 'NP', 'OM', 'PH', 'PK', 'QA', 'SA', 'SG', 'TH', 'TR', 'TW', 'UZ', 'VN', 'YE', 'SOUTH KOREA']),
    EUROPE: new Set(['AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'UA', 'VA', 'UK']),
    NORTH_AMERICA: new Set(['AG', 'BB', 'BS', 'BZ', 'CA', 'CR', 'CU', 'DO', 'GT', 'HN', 'HT', 'JM', 'MX', 'NI', 'PA', 'PR', 'SV', 'TT', 'US']),
    SOUTH_AMERICA: new Set(['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE']),
    OCEANIA: new Set(['AU', 'FJ', 'FM', 'NC', 'NZ', 'PG', 'PF', 'WS']),
    AFRICA: new Set(['AO', 'BF', 'BJ', 'BW', 'CD', 'CI', 'CM', 'DZ', 'EG', 'ET', 'GH', 'KE', 'MA', 'ML', 'MU', 'MZ', 'NA', 'NG', 'RW', 'SC', 'SD', 'SN', 'TN', 'TZ', 'UG', 'ZA', 'ZM', 'ZW']),
};

function getKoreaDateOnly() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
}

function dateOnlyToMs(value: string | null | undefined) {
    if (!value) return null;
    const dateOnly = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
    return Date.parse(`${dateOnly}T00:00:00.000Z`);
}

function msToDateOnly(ms: number) {
    return new Date(ms).toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
    const ms = dateOnlyToMs(dateOnly);
    return ms == null ? dateOnly : msToDateOnly(ms + days * DAY_MS);
}

function getNextSevenDateOnlyRange(todayDateOnly: string) {
    const todayMs = dateOnlyToMs(todayDateOnly);
    if (todayMs == null) return Array.from({ length: 7 }, (_, index) => addDays(todayDateOnly, index));
    return Array.from({ length: 7 }, (_, index) => msToDateOnly(todayMs + index * DAY_MS));
}

function getDaysUntilEnd(endDate: string | null | undefined, todayDateOnly: string) {
    const endMs = dateOnlyToMs(endDate);
    const todayMs = dateOnlyToMs(todayDateOnly);
    if (endMs == null || todayMs == null) return null;
    return Math.round((endMs - todayMs) / DAY_MS);
}

function getDaysUntilStart(startDate: string | null | undefined, todayDateOnly: string) {
    const startMs = dateOnlyToMs(startDate);
    const todayMs = dateOnlyToMs(todayDateOnly);
    if (startMs == null || todayMs == null) return null;
    return Math.round((startMs - todayMs) / DAY_MS);
}

function getContinentKey(country: string | null | undefined): ContinentKey | null {
    const normalized = (country || '').trim().toUpperCase();
    if (!normalized) return null;
    for (const key of CONTINENT_ORDER) {
        if (key !== 'ALL' && CONTINENT_COUNTRIES[key].has(normalized)) return key;
    }
    return null;
}

function compareDateValues(a?: string | null, b?: string | null) {
    const aMs = dateOnlyToMs(a) ?? Number.POSITIVE_INFINITY;
    const bMs = dateOnlyToMs(b) ?? Number.POSITIVE_INFINITY;
    return aMs - bMs;
}

function isSameDateOnly(value: string | null | undefined, dateOnly: string) {
    return Boolean(value) && value?.slice(0, 10) === dateOnly;
}

function isExhibitionActiveOnDate(exhibition: ExhibitionViewItem, dateOnly: string) {
    const dateMs = dateOnlyToMs(dateOnly);
    const startMs = dateOnlyToMs(exhibition.startDate);
    const endMs = dateOnlyToMs(exhibition.endDate);
    if (dateMs == null) return false;
    return (startMs == null || startMs <= dateMs) && (endMs == null || endMs >= dateMs);
}

function getWeekCalendarLabels(locale: string) {
    return WEEK_CALENDAR_LABELS[locale] || WEEK_CALENDAR_LABELS.en;
}

function formatWeekday(dateOnly: string, locale: string) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

function getWeekdayToneClass(dateOnly: string) {
    const dateMs = dateOnlyToMs(dateOnly);
    if (dateMs == null) return 'is-weekday';
    const day = new Date(dateMs).getUTCDay();
    if (day === 0) return 'is-sunday';
    if (day === 6) return 'is-saturday';
    return 'is-weekday';
}

function formatWeekDate(dateOnly: string, locale: string) {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

function buildWeekSchedule(items: ExhibitionViewItem[], todayDateOnly: string): WeekDaySchedule[] {
    const priority: Record<ScheduleKind, number> = { end: 0, ongoing: 1, start: 2 };
    return getNextSevenDateOnlyRange(todayDateOnly).map((dateOnly) => {
        const entries = items
            .map<WeekScheduleEntry | null>((exhibition) => {
                const starts = isSameDateOnly(exhibition.startDate, dateOnly);
                const ends = isSameDateOnly(exhibition.endDate, dateOnly);
                const active = isExhibitionActiveOnDate(exhibition, dateOnly);
                if (!starts && !ends && !active) return null;
                return {
                    exhibition,
                    kind: ends ? 'end' : starts ? 'start' : 'ongoing',
                };
            })
            .filter((entry): entry is WeekScheduleEntry => Boolean(entry))
            .sort((a, b) => {
                const priorityDiff = priority[a.kind] - priority[b.kind];
                if (priorityDiff !== 0) return priorityDiff;
                return compareDateValues(a.exhibition.endDate, b.exhibition.endDate)
                    || compareDateValues(a.exhibition.startDate, b.exhibition.startDate)
                    || a.exhibition.id.localeCompare(b.exhibition.id);
            });

        return {
            dateOnly,
            entries,
            previewEntries: entries.slice(0, 3),
            hiddenCount: Math.max(0, entries.length - 3),
            activeCount: items.filter((item) => isExhibitionActiveOnDate(item, dateOnly)).length,
            isToday: dateOnly === todayDateOnly,
        };
    });
}

function getRegionChipStyle(region: ContinentKey): CSSProperties {
    const color = { ...REGION_CHIP_COLORS[region], ...REGION_CHIP_COLORS.ALL };
    return {
        '--exhibition-region-color': color.color,
        '--exhibition-region-strong': color.strong,
        '--exhibition-region-bg': color.bg,
        '--exhibition-region-border': color.border,
        '--exhibition-region-dark-bg': color.darkBg,
        '--exhibition-region-dark-border': color.darkBorder,
    } as CSSProperties;
}

function seededRandom(seed: number) {
    const next = Math.sin(seed) * 10000;
    return next - Math.floor(next);
}

function getShuffledExhibitions(items: ExhibitionViewItem[], seed: number) {
    return [...items]
        .map((item, index) => ({ item, rank: seededRandom(seed + index * 97 + item.id.length * 13) }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ item }) => item);
}

function hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function deterministicShuffle<T>(items: T[], seed: string, keyFn: (item: T) => string): T[] {
    return [...items].sort((a, b) => {
        const aKey = keyFn(a);
        const bKey = keyFn(b);
        const aHash = hashString(`${seed}:${aKey}`);
        const bHash = hashString(`${seed}:${bKey}`);
        if (aHash !== bHash) return aHash - bHash;
        return aKey.localeCompare(bKey);
    });
}

function getSortLabel(mode: ExhibitionSortMode, locale: string) {
    const labels = SORT_LABELS[mode];
    return labels[locale] || labels.en;
}

function getSessionRandomSeed() {
    if (typeof window === 'undefined') return 'mm-exhibition-list';
    try {
        const saved = sessionStorage.getItem(EXHIBITION_RANDOM_SEED_KEY);
        if (saved) return saved;
        const next = `mm-exhibition-list-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(EXHIBITION_RANDOM_SEED_KEY, next);
        return next;
    } catch {
        return `mm-exhibition-list-${Date.now()}`;
    }
}

function normalizeExhibitionSearchText(value: unknown) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function collectTranslationText(value: Record<string, string> | null | undefined) {
    if (!value || typeof value !== 'object') return '';
    return Object.values(value).filter(Boolean).join(' ');
}

function getExhibitionSearchLabels(locale: string) {
    return EXHIBITION_SEARCH_LABELS[locale] || EXHIBITION_SEARCH_LABELS.en;
}

function getExhibitionSearchText(exhibition: ExhibitionViewItem, locale: Locale) {
    const museum = exhibition.museum;
    const countryName = museum?.country ? getCountryName(museum.country, locale) : '';
    return normalizeExhibitionSearchText([
        getLocalizedExhibitionTitle(exhibition, locale),
        exhibition.title,
        collectTranslationText(exhibition.titleTranslations),
        exhibition.description,
        museum ? getLocalizedMuseumName(museum, locale) : '',
        museum?.name,
        museum?.nameKo,
        museum?.nameEn,
        collectTranslationText(museum?.nameTranslations),
        museum ? getLocalizedCityName(museum, locale) : '',
        museum?.city,
        museum?.cityKo,
        collectTranslationText(museum?.cityTranslations),
        countryName,
        museum?.country,
    ].filter(Boolean).join(' '));
}

function getExhibitionDistance(exhibition: ExhibitionViewItem, userLocation: { lat: number; lng: number }) {
    const lat = exhibition.museum?.latitude;
    const lng = exhibition.museum?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return Number.POSITIVE_INFINITY;
    const dLat = lat - userLocation.lat;
    const dLng = lng - userLocation.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
}

function compareStartImminence(a: ExhibitionViewItem, b: ExhibitionViewItem) {
    const aRank = a.daysUntilStart != null && a.daysUntilStart >= 0 ? a.daysUntilStart : null;
    const bRank = b.daysUntilStart != null && b.daysUntilStart >= 0 ? b.daysUntilStart : null;
    if (aRank != null && bRank != null) return aRank - bRank || compareDateValues(a.startDate, b.startDate) || compareDateValues(a.endDate, b.endDate);
    if (aRank != null) return -1;
    if (bRank != null) return 1;
    return compareDateValues(a.endDate, b.endDate) || compareDateValues(a.startDate, b.startDate);
}

function formatExhibitionDate(value: string | null | undefined, locale: string) {
    const ms = dateOnlyToMs(value);
    if (ms == null) return '';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(ms));
}

function formatDateRange(exhibition: ExhibitionItem, locale: string) {
    const start = formatExhibitionDate(exhibition.startDate, locale);
    const end = formatExhibitionDate(exhibition.endDate, locale);
    if (start && end) return `${start} - ${end}`;
    return start || end;
}

function getTimingLabel(exhibition: ExhibitionViewItem, labels: PageLabels, todayDateOnly: string) {
    const startMs = dateOnlyToMs(exhibition.startDate);
    const todayMs = dateOnlyToMs(todayDateOnly);
    const daysUntilStart = startMs != null && todayMs != null ? Math.round((startMs - todayMs) / DAY_MS) : null;
    if (daysUntilStart != null && daysUntilStart > 0) {
        return { status: labels.upcoming, tag: labels.startsIn(daysUntilStart), upcoming: true };
    }
    if (daysUntilStart === 0) {
        return { status: labels.ongoing, tag: labels.startsToday, upcoming: false };
    }
    if (exhibition.daysUntilEnd === 0) {
        return { status: labels.ongoing, tag: labels.endedToday, upcoming: false };
    }
    if (exhibition.daysUntilEnd != null && exhibition.daysUntilEnd > 0) {
        return { status: labels.ongoing, tag: labels.endsIn(exhibition.daysUntilEnd), upcoming: false };
    }
    return { status: labels.ongoing, tag: '', upcoming: false };
}

function hasVerifiedOfficialBadge(exhibition: ExhibitionItem) {
    const source = String(exhibition.source || '');
    return source.startsWith('OFFICIAL_') && !/(NEEDS_RECHECK|UNVERIFIED|PENDING|HOLD)/i.test(source);
}

function markMuseumNavigation() {
    try { sessionStorage.setItem('navigating-forward', String(Date.now())); } catch { }
}

function getScheduleKindLabel(kind: ScheduleKind, labels: WeekCalendarLabels) {
    if (kind === 'start') return labels.start;
    if (kind === 'end') return labels.end;
    return labels.ongoing;
}

function getCloseLabel(locale: string) {
    const labels: Record<string, string> = {
        ko: '닫기',
        ja: '閉じる',
        de: 'Schließen',
        fr: 'Fermer',
        es: 'Cerrar',
        pt: 'Fechar',
        'zh-CN': '关闭',
        'zh-TW': '關閉',
        da: 'Luk',
        fi: 'Sulje',
        sv: 'Stäng',
        et: 'Sulge',
    };
    return labels[locale] || 'Close';
}

function ExhibitionVenueGlyph({ className = '' }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.7}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M5.25 21V9.75L12 4.5l6.75 5.25V21M9 21v-6h6v6M8.25 10.5h.008v.008H8.25v-.008Zm3.75 0h.008v.008H12v-.008Zm3.75 0h.008v.008h-.008v-.008Z"
            />
        </svg>
    );
}

function ExhibitionCard({ exhibition, labels, locale, todayDateOnly, rail = false, featured = false, endingSoon = false, startingSoon = false }: { exhibition: ExhibitionViewItem; labels: PageLabels; locale: Locale; todayDateOnly: string; rail?: boolean; featured?: boolean; endingSoon?: boolean; startingSoon?: boolean }) {
    const museum = exhibition.museum;
    const [imgError, setImgError] = useState(false);
    const imageSrc = !imgError && isRenderableUrl(exhibition.imageUrl) ? exhibition.imageUrl : (museum ? getMuseumImageSrc(museum) : null);
    const timing = getTimingLabel(exhibition, labels, todayDateOnly);
    const dateRange = formatDateRange(exhibition, locale);
    const title = getLocalizedExhibitionTitle(exhibition, locale);
    const museumName = museum ? getLocalizedMuseumName(museum, locale) : '';
    const cityName = museum ? getLocalizedCityName(museum, locale) : '';
    const countryName = museum?.country ? getCountryName(museum.country, locale) : '';
    const museumHref = museum?.id ? `/museums/${museum.id}?from=exhibitions` : null;
    const isEndingState = !timing.upcoming && exhibition.daysUntilEnd != null && exhibition.daysUntilEnd >= 0 && exhibition.daysUntilEnd <= 20;
    const showImageStatus = rail || featured || endingSoon || startingSoon;
    const imageDday = showImageStatus ? timing.tag : '';

    const cardMain = (
        <>
            <div className="mm-exhibition-list-thumb">
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt=""
                        className="opacity-0"
                        loading="lazy"
                        decoding="async"
                        onLoad={(event) => {
                            event.currentTarget.classList.remove('opacity-0');
                            event.currentTarget.classList.add('opacity-100');
                        }}
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="mm-exhibition-list-empty-thumb">
                        <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
                    </div>
                )}
                {hasVerifiedOfficialBadge(exhibition) && (
                    <span className="mm-exhibition-list-source" aria-label={labels.official} title={labels.official}>
                        <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                )}
                {imageDday && (
                    <span className={`mm-exhibition-thumb-dday ${timing.upcoming ? 'is-upcoming' : 'is-ongoing'}`}>
                        {imageDday}
                    </span>
                )}
                {showImageStatus && (
                    <span className={`mm-exhibition-image-status ${timing.upcoming ? 'is-upcoming' : 'is-ongoing'}`}>
                        {timing.status}
                    </span>
                )}
            </div>

            <div className="mm-exhibition-list-body">
                {!showImageStatus && (
                    <div className="mm-exhibition-list-topline">
                        <span className={`mm-exhibition-list-status ${timing.upcoming ? 'is-upcoming' : 'is-ongoing'}`}>{timing.status}</span>
                        {timing.tag && <span className="mm-exhibition-list-dday"><Clock3 className="h-3 w-3" aria-hidden="true" />{timing.tag}</span>}
                    </div>
                )}
                <h3>{title}</h3>
                {dateRange && (
                    <p className="mm-exhibition-list-period">
                        <span className="sr-only">{labels.period}: </span>
                        {dateRange}
                    </p>
                )}
                {museumName && (
                    <p className="mm-exhibition-list-museum">
                        <ExhibitionVenueGlyph className="mm-exhibition-list-venue-icon h-3.5 w-3.5 shrink-0" />
                        <strong>{museumName}</strong>
                    </p>
                )}
                {(cityName || countryName) && (
                    <p className="mm-exhibition-list-place">
                        <svg className="mm-exhibition-list-venue-icon h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span>{[cityName, countryName].filter(Boolean).join(', ')}</span>
                    </p>
                )}
                {exhibition.description && <p className="mm-exhibition-list-desc">{exhibition.description}</p>}
            </div>
        </>
    );

    return (
        <article
            data-exhibition-card="true"
            className={`mm-exhibition-list-card ${rail ? 'is-rail' : ''} ${featured ? 'is-featured' : ''} ${exhibition.link ? 'has-official-link' : ''} ${timing.upcoming ? 'is-upcoming-card' : 'is-ongoing-card'} ${isEndingState ? 'is-ending-state' : ''} ${endingSoon ? 'is-ending-soon' : ''} ${startingSoon ? 'is-starting-soon' : ''}`}
        >
            {museumHref ? (
                <Link
                    className="mm-exhibition-list-main"
                    href={museumHref}
                    prefetch={false}
                    onClick={markMuseumNavigation}
                    aria-label={museumName ? `${title}, ${labels.venue}: ${museumName}` : title}
                >
                    {cardMain}
                </Link>
            ) : (
                <div className="mm-exhibition-list-main">{cardMain}</div>
            )}
            {exhibition.link && (
                <div className="mm-exhibition-list-footer">
                    <a
                        className="mm-exhibition-list-link"
                        href={exhibition.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={labels.openLink}
                        title={labels.openLink}
                    >
                        <span className="mm-exhibition-list-link-label">{labels.openLink}</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                </div>
            )}
        </article>
    );
}

function ExhibitionSearchResult({ exhibition, labels, locale }: { exhibition: ExhibitionViewItem; labels: PageLabels; locale: Locale }) {
    const museum = exhibition.museum;
    const [imgError, setImgError] = useState(false);
    const imageSrc = !imgError && isRenderableUrl(exhibition.imageUrl) ? exhibition.imageUrl : (museum ? getMuseumImageSrc(museum) : null);
    const title = getLocalizedExhibitionTitle(exhibition, locale);
    const museumName = museum ? getLocalizedMuseumName(museum, locale) : '';
    const cityName = museum ? getLocalizedCityName(museum, locale) : '';
    const countryName = museum?.country ? getCountryName(museum.country, locale) : '';
    const dateRange = formatDateRange(exhibition, locale);
    const museumHref = museum?.id ? `/museums/${museum.id}?from=exhibitions` : null;
    const placeLine = [museumName, cityName || countryName].filter(Boolean).join(' · ');

    const content = (
        <>
            <span className="mm-map2-search-result-thumb mm-exhibition-search-thumb">
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <img src="/logo.svg" alt="" className="mm-empty-logo dark:invert" />
                )}
                {hasVerifiedOfficialBadge(exhibition) && (
                    <span className="mm-exhibition-search-official" aria-label={labels.official} title={labels.official}>
                        <CircleCheck className="h-3 w-3" aria-hidden="true" />
                    </span>
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="mm-map2-search-result-title truncate">{title}</span>
                {placeLine && <span className="mm-map2-search-result-subtitle truncate">{placeLine}</span>}
                {dateRange && <span className="mm-exhibition-search-meta truncate">{dateRange}</span>}
            </span>
        </>
    );

    if (museumHref) {
        return (
            <Link
                href={museumHref}
                prefetch={false}
                onClick={markMuseumNavigation}
                className="mm-exhibition-search-result mm-map2-search-result w-full text-left px-4 py-3 transition-colors border-b last:border-0 flex items-center gap-3"
                aria-label={museumName ? `${title}, ${labels.venue}: ${museumName}` : title}
            >
                {content}
            </Link>
        );
    }

    if (exhibition.link) {
        return (
            <a
                href={exhibition.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mm-exhibition-search-result mm-map2-search-result w-full text-left px-4 py-3 transition-colors border-b last:border-0 flex items-center gap-3"
                aria-label={title}
            >
                {content}
            </a>
        );
    }

    return (
        <div className="mm-exhibition-search-result mm-map2-search-result w-full text-left px-4 py-3 border-b last:border-0 flex items-center gap-3">
            {content}
        </div>
    );
}

function ExhibitionWeekStack({ day, labels, locale }: { day: WeekDaySchedule; labels: WeekCalendarLabels; locale: Locale }) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const entries = day.previewEntries;
    const canRotate = day.isToday && entries.length > 1 && !prefersReducedMotion;
    const [activeIndex, setActiveIndex] = useState(0);
    const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
    const leavingTimerRef = useRef<number | null>(null);

    useEffect(() => {
        setActiveIndex(0);
        setLeavingIndex(null);
        if (leavingTimerRef.current != null) {
            window.clearTimeout(leavingTimerRef.current);
            leavingTimerRef.current = null;
        }
    }, [day.dateOnly, entries.length]);

    useEffect(() => {
        if (!canRotate) return;
        const intervalId = window.setInterval(() => {
            setActiveIndex((currentIndex) => {
                setLeavingIndex(currentIndex);
                return (currentIndex + 1) % entries.length;
            });
        }, 1600);
        return () => window.clearInterval(intervalId);
    }, [canRotate, entries.length]);

    useEffect(() => {
        if (leavingIndex == null) return;
        if (leavingTimerRef.current != null) window.clearTimeout(leavingTimerRef.current);
        leavingTimerRef.current = window.setTimeout(() => {
            setLeavingIndex(null);
            leavingTimerRef.current = null;
        }, 620);
        return () => {
            if (leavingTimerRef.current != null) {
                window.clearTimeout(leavingTimerRef.current);
                leavingTimerRef.current = null;
            }
        };
    }, [leavingIndex]);

    const getCardState = (index: number) => {
        if (canRotate && leavingIndex === index) return 'leaving';
        if (!canRotate) return index === 0 ? 'active' : index === 1 ? 'next' : 'back';
        const position = (index - activeIndex + entries.length) % entries.length;
        if (position === 0) return 'active';
        if (position === 1) return 'next';
        if (position === 2) return 'back';
        return 'hidden';
    };

    const getCardStyle = (state: string): CSSProperties => {
        const styleByState: Record<string, { top: number; x: number; scale: number; opacity: number; z: number }> = {
            active: { top: 0, x: 0, scale: 1, opacity: 1, z: 5 },
            next: { top: 10, x: 7, scale: 0.965, opacity: 0.54, z: 4 },
            back: { top: 19, x: 12, scale: 0.925, opacity: 0.24, z: 3 },
            hidden: { top: 19, x: 12, scale: 0.925, opacity: 0, z: 1 },
            leaving: { top: 0, x: 0, scale: 0.985, opacity: 0, z: 6 },
        };
        const style = styleByState[state] ?? styleByState.hidden;
        return {
            '--week-stack-top': `${style.top}px`,
            '--week-stack-x': `${style.x}px`,
            '--week-stack-scale': style.scale,
            '--week-stack-opacity': style.opacity,
            '--week-stack-z': style.z,
        } as CSSProperties;
    };

    return (
        <span className={`mm-exhibition-week-stack ${canRotate ? 'is-rotating' : ''}`} aria-hidden="true">
            {entries.map(({ exhibition, kind }, index) => {
                const museum = exhibition.museum;
                const title = getLocalizedExhibitionTitle(exhibition, locale);
                const museumName = museum ? getLocalizedMuseumName(museum, locale) : '';
                const cardState = getCardState(index);
                const showContent = cardState === 'active' || cardState === 'leaving';
                return (
                    <span
                        key={`${day.dateOnly}-${kind}-${exhibition.id}`}
                        className={`mm-exhibition-week-stack-card is-${kind} is-${cardState} ${cardState === 'active' || cardState === 'leaving' ? '' : 'is-shadow'}`}
                        style={getCardStyle(cardState)}
                    >
                        {showContent && (
                            <span className="mm-exhibition-week-stack-content">
                                <span className={`mm-exhibition-week-tag is-${kind}`}>{getScheduleKindLabel(kind, labels)}</span>
                                <strong>{title}</strong>
                                {museumName && <small>{museumName}</small>}
                            </span>
                        )}
                    </span>
                );
            })}
            {day.hiddenCount > 0 && <span className="mm-exhibition-week-more-badge">+{day.hiddenCount.toLocaleString(locale)}</span>}
        </span>
    );
}

function ExhibitionWeekCalendar({
    days,
    labels,
    locale,
    selectedDay,
    onSelectDay,
    onCloseDay,
}: {
    days: WeekDaySchedule[];
    labels: WeekCalendarLabels;
    locale: Locale;
    selectedDay: WeekDaySchedule | null;
    onSelectDay: (dateOnly: string) => void;
    onCloseDay: () => void;
}) {
    const hasSchedule = days.some(day => day.entries.length > 0);
    const closeLabel = getCloseLabel(locale);
    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setPortalRoot(document.body);
    }, []);

    const dialog = selectedDay && selectedDay.entries.length > 0 ? (
        <div className={styles.exhibitionsPage}>
            <div className="mm-exhibition-week-dialog-backdrop" role="presentation" onClick={onCloseDay}>
                <div
                    id="exhibition-week-dialog"
                    className="mm-exhibition-week-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="exhibition-week-dialog-title"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className={`mm-exhibition-week-dialog-head ${getWeekdayToneClass(selectedDay.dateOnly)}`}>
                        <div>
                            <span>{formatWeekday(selectedDay.dateOnly, locale)}</span>
                            <h3 id="exhibition-week-dialog-title">{formatWeekDate(selectedDay.dateOnly, locale)}</h3>
                        </div>
                        <button type="button" className="mm-exhibition-week-dialog-close" onClick={onCloseDay} aria-label={closeLabel}>
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="mm-exhibition-week-dialog-list">
                        {selectedDay.entries.map(({ exhibition, kind }) => {
                            const museum = exhibition.museum;
                            const title = getLocalizedExhibitionTitle(exhibition, locale);
                            const museumName = museum ? getLocalizedMuseumName(museum, locale) : '';
                            const dateRange = formatDateRange(exhibition, locale);
                            const museumHref = museum?.id ? `/museums/${museum.id}?from=exhibitions` : null;
                            const content = (
                                <>
                                    <span className={`mm-exhibition-week-tag is-${kind}`}>{getScheduleKindLabel(kind, labels)}</span>
                                    <span className="mm-exhibition-week-dialog-copy">
                                        <strong>{title}</strong>
                                        {museumName && <small>{museumName}</small>}
                                        {dateRange && <em>{dateRange}</em>}
                                    </span>
                                </>
                            );
                            return museumHref ? (
                                <Link
                                    key={`dialog-${selectedDay.dateOnly}-${kind}-${exhibition.id}`}
                                    className="mm-exhibition-week-dialog-item"
                                    href={museumHref}
                                    prefetch={false}
                                    onClick={markMuseumNavigation}
                                >
                                    {content}
                                </Link>
                            ) : (
                                <div key={`dialog-${selectedDay.dateOnly}-${kind}-${exhibition.id}`} className="mm-exhibition-week-dialog-item">
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            <section className="mm-exhibition-week-card animate-fadeInUp" aria-labelledby="exhibition-week-title">
                <div className="mm-exhibition-week-head">
                    <div className="mm-exhibition-week-title">
                        <div>
                            <h2 id="exhibition-week-title">{labels.title}</h2>
                            <p>{labels.subtitle}</p>
                        </div>
                    </div>
                </div>

                {hasSchedule ? (
                    <div className="mm-exhibition-week-grid" data-no-swipe-back>
                        {days.map((day) => {
                            const hasEntries = day.entries.length > 0;
                            const isSelected = selectedDay?.dateOnly === day.dateOnly;
                            return (
                                <button
                                    key={day.dateOnly}
                                    type="button"
                                    className={`mm-exhibition-week-day ${getWeekdayToneClass(day.dateOnly)} ${day.isToday ? 'is-today' : ''} ${hasEntries ? '' : 'is-empty'} ${isSelected ? 'is-selected' : ''}`}
                                    disabled={!hasEntries}
                                    aria-haspopup={hasEntries ? 'dialog' : undefined}
                                    aria-expanded={hasEntries ? isSelected : undefined}
                                    aria-controls={hasEntries ? 'exhibition-week-dialog' : undefined}
                                    onClick={() => {
                                        if (hasEntries) onSelectDay(day.dateOnly);
                                    }}
                                >
                                    <span className="mm-exhibition-week-date">
                                        <span>{formatWeekday(day.dateOnly, locale)}</span>
                                        <strong>{formatWeekDate(day.dateOnly, locale)}</strong>
                                        <em className={day.isToday ? '' : 'is-placeholder'} aria-hidden={day.isToday ? undefined : true}>
                                            {labels.today}
                                        </em>
                                    </span>

                                    {hasEntries ? (
                                        <ExhibitionWeekStack day={day} labels={labels} locale={locale} />
                                    ) : (
                                        <span className="mm-exhibition-week-empty">{labels.noItems}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mm-exhibition-week-empty-panel">{labels.empty}</div>
                )}
            </section>

            {portalRoot && dialog ? createPortal(dialog, portalRoot) : null}
        </>
    );
}

function ExhibitionEmptyState({ title, body, compact = false }: { title: string; body?: string; compact?: boolean }) {
    return (
        <div className={`mm-exhibition-empty-state ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
            <div className="mm-exhibition-empty-icon" aria-hidden="true">
                <SearchX className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <h3>{title}</h3>
                {body && <p>{body}</p>}
            </div>
        </div>
    );
}

function ExhibitionsSkeleton() {
    return (
        <div data-mm-page="exhibitions" className={`${styles.exhibitionsPage} mm-nav-page-enter no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10`}>
            <div className="mm-gallery-hero p-5 sm:p-7 mb-5 sm:mb-6">
                <div className="mm-skel-line w-24 mb-4 opacity-40" />
                <div className="mm-skel-line h-8 w-36 mb-3 opacity-50" />
                <div className="mm-skel-line w-72 opacity-40" />
                <div className="mt-5 flex gap-2 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="mm-skel-pill w-24 opacity-40" />)}
                </div>
            </div>
            <div className="mm-section-heading">
                <div className="mm-skel-line h-5 w-32" />
                <div className="mm-skel-line w-12" />
            </div>
            <div className="mm-rail-scroll">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="mm-actual-skeleton mm-exhibition-list-card is-rail">
                        <div className="mm-skel-block h-28 rounded-none" />
                        <div className="p-4">
                            <div className="mm-skel-line w-20 mb-3" />
                            <div className="mm-skel-line h-5 w-40 mb-2" />
                            <div className="mm-skel-line w-32" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="mm-section-heading">
                <div className="mm-skel-line h-5 w-32" />
            </div>
            <div className="mm-exhibition-card-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="mm-actual-skeleton mm-exhibition-list-card">
                        <div className="mm-skel-block h-32 rounded-none" />
                        <div className="p-4">
                            <div className="mm-skel-line w-20 mb-3" />
                            <div className="mm-skel-line h-5 w-48 mb-2" />
                            <div className="mm-skel-line w-32" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ExhibitionsPage() {
    const { locale } = useApp();
    const labels = PAGE_LABELS[locale] || PAGE_LABELS.en;
    const searchLabels = getExhibitionSearchLabels(locale);
    const [exhibitions, setExhibitions] = useState<ExhibitionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeRegion, setActiveRegion] = useState<ContinentKey>('ALL');
    const [filterSettling, setFilterSettling] = useState(false);
    const [page, setPage] = useState(1);
    const [sortMode, setSortMode] = useState<ExhibitionSortMode>('random');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [featureSeed, setFeatureSeed] = useState(() => Date.now());
    const [listRandomSeed] = useState(() => getSessionRandomSeed());
    const [selectedWeekDateOnly, setSelectedWeekDateOnly] = useState<string | null>(null);
    const filterTimerRef = useRef<number | null>(null);
    const todayDateOnly = useMemo(() => getKoreaDateOnly(), []);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const normalizedSearchQuery = useMemo(() => normalizeExhibitionSearchText(deferredSearchQuery), [deferredSearchQuery]);

    useEffect(() => {
        if (!isSearchFocused) return;
        return lockMobileSearchChrome();
    }, [isSearchFocused]);

    const loadExhibitions = () => {
        setLoading(true);
        setError(false);
        fetch('/api/exhibitions?limit=1000')
            .then(res => {
                if (!res.ok) throw new Error('Failed to load exhibitions');
                return res.json();
            })
            .then(payload => {
                const next = payload?.data?.exhibitions;
                setExhibitions(Array.isArray(next) ? next : []);
            })
            .catch(() => {
                setError(true);
                setExhibitions([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadExhibitions();
    }, []);

    useEffect(() => {
        if (sortMode === 'distance' && !userLocation) {
            navigator.geolocation?.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => { },
            );
        }
    }, [sortMode, userLocation]);

    useEffect(() => {
        return () => {
            if (filterTimerRef.current != null) {
                window.clearTimeout(filterTimerRef.current);
            }
        };
    }, []);

    const viewItems = useMemo<ExhibitionViewItem[]>(() => {
        return exhibitions
            .map((exhibition) => ({
                ...exhibition,
                continent: getContinentKey(exhibition.museum?.country),
                daysUntilEnd: getDaysUntilEnd(exhibition.endDate, todayDateOnly),
                daysUntilStart: getDaysUntilStart(exhibition.startDate, todayDateOnly),
            }))
            .filter(exhibition => exhibition.daysUntilEnd == null || exhibition.daysUntilEnd >= 0)
            .sort((a, b) => compareDateValues(a.startDate, b.startDate) || compareDateValues(a.endDate, b.endDate));
    }, [exhibitions, todayDateOnly]);

    const regionCounts = useMemo(() => {
        const counts = new Map<ContinentKey, number>();
        counts.set('ALL', viewItems.length);
        viewItems.forEach((item) => {
            if (!item.continent) return;
            counts.set(item.continent, (counts.get(item.continent) || 0) + 1);
        });
        return counts;
    }, [viewItems]);

    const searchIndexItems = useMemo(() => {
        return viewItems.map(item => ({
            item,
            searchText: getExhibitionSearchText(item, locale as Locale),
        }));
    }, [locale, viewItems]);

    const searchFilteredItems = useMemo(() => {
        if (!normalizedSearchQuery) return [];
        const tokens = normalizedSearchQuery.split(/\s+/).filter(Boolean);
        return searchIndexItems
            .filter(({ searchText }) => tokens.every(token => searchText.includes(token)))
            .map(({ item }) => item);
    }, [normalizedSearchQuery, searchIndexItems]);

    const regionFilteredItems = useMemo(() => {
        if (activeRegion === 'ALL') return viewItems;
        return viewItems.filter(item => item.continent === activeRegion);
    }, [activeRegion, viewItems]);

    const filteredItems = normalizedSearchQuery ? searchFilteredItems : regionFilteredItems;
    const searchResults = useMemo(() => searchFilteredItems.slice(0, 8), [searchFilteredItems]);

    const weekCalendarLabels = useMemo(() => getWeekCalendarLabels(locale), [locale]);
    const weekScheduleDays = useMemo(() => buildWeekSchedule(filteredItems, todayDateOnly), [filteredItems, todayDateOnly]);
    const selectedWeekDay = useMemo(() => {
        if (!selectedWeekDateOnly) return null;
        return weekScheduleDays.find(day => day.dateOnly === selectedWeekDateOnly && day.entries.length > 0) || null;
    }, [selectedWeekDateOnly, weekScheduleDays]);

    useEffect(() => {
        if (selectedWeekDateOnly && !selectedWeekDay) {
            setSelectedWeekDateOnly(null);
        }
    }, [selectedWeekDateOnly, selectedWeekDay]);

    useEffect(() => {
        if (!selectedWeekDay) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSelectedWeekDateOnly(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedWeekDay]);

    const currentItems = useMemo(() => {
        return filteredItems.filter(item => item.daysUntilStart == null || item.daysUntilStart <= 0);
    }, [filteredItems]);

    const endingSoonItems = useMemo(() => {
        return currentItems
            .filter(item => item.daysUntilEnd != null && item.daysUntilEnd >= 0 && item.daysUntilEnd <= 20)
            .sort((a, b) => (a.daysUntilEnd ?? 999) - (b.daysUntilEnd ?? 999) || compareDateValues(a.endDate, b.endDate));
    }, [currentItems]);

    const startingSoonItems = useMemo(() => {
        return filteredItems
            .filter(item => item.daysUntilStart != null && item.daysUntilStart > 0 && item.daysUntilStart <= 20)
            .sort((a, b) => (a.daysUntilStart ?? 999) - (b.daysUntilStart ?? 999) || compareDateValues(a.startDate, b.startDate));
    }, [filteredItems]);

    const featuredItems = useMemo(() => {
        return getShuffledExhibitions(currentItems, featureSeed).slice(0, 12);
    }, [currentItems, featureSeed]);

    const sortedListItems = useMemo(() => {
        const items = [...filteredItems];
        switch (sortMode) {
            case 'endingSoon':
                return items.sort((a, b) => (a.daysUntilEnd ?? 99999) - (b.daysUntilEnd ?? 99999) || compareDateValues(a.endDate, b.endDate));
            case 'startingSoon':
                return items.sort(compareStartImminence);
            case 'distance':
                if (!userLocation) return items;
                return items.sort((a, b) => getExhibitionDistance(a, userLocation) - getExhibitionDistance(b, userLocation) || compareDateValues(a.endDate, b.endDate));
            case 'random':
            default:
                return deterministicShuffle(items, `${listRandomSeed}:${activeRegion}`, (item) => item.id);
        }
    }, [activeRegion, filteredItems, listRandomSeed, sortMode, userLocation]);

    const totalPages = Math.max(1, Math.ceil(sortedListItems.length / EXHIBITION_LIST_PER_PAGE));
    const paginatedListItems = sortedListItems.slice((page - 1) * EXHIBITION_LIST_PER_PAGE, page * EXHIBITION_LIST_PER_PAGE);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const allEmptyTitle = normalizedSearchQuery ? searchLabels.empty : viewItems.length === 0 ? labels.emptyAll : (labels.emptyFiltered || labels.emptyAll);
    const emptyBody = labels.emptyBody || labels.emptyAll;

    const handleRegionSelect = (region: ContinentKey) => {
        if (region === activeRegion) return;
        if (filterTimerRef.current != null) {
            window.clearTimeout(filterTimerRef.current);
        }
        setFilterSettling(true);
        setActiveRegion(region);
        setPage(1);
        setSelectedWeekDateOnly(null);
        filterTimerRef.current = window.setTimeout(() => {
            setFilterSettling(false);
            filterTimerRef.current = null;
        }, 180);
    };

    const handleSortChange = (mode: ExhibitionSortMode) => {
        setSortMode(mode);
        setPage(1);
    };

    const goToPage = (nextPage: number) => {
        setPage(Math.min(Math.max(1, nextPage), totalPages));
    };

    if (loading) return <ExhibitionsSkeleton />;

    return (
        <div data-mm-page="exhibitions" className={`${styles.exhibitionsPage} mm-nav-page-enter no-back-swipe mm-editorial-page2 mm-library-page2 w-full max-w-[960px] mx-auto px-4 pt-4 sm:px-6 sm:pt-8 md:px-8 pb-32 lg:pb-10`}>
            <div className="mm-gallery-hero p-5 sm:p-7 mb-4 sm:mb-6 animate-fadeInUp">
                <div className="mm-gallery-kicker mb-3">{labels.kicker}</div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{labels.title}</h1>
                <p className="text-blue-100/80 mt-2 text-sm font-medium">{labels.subtitle}</p>
                <div className="flex mt-5 gap-2 overflow-x-auto scrollbar-hide" aria-label={labels.regionLabel}>
                    {CONTINENT_ORDER.map(region => {
                        const isActive = activeRegion === region;
                        const count = regionCounts.get(region) || 0;
                        return (
                            <button
                                key={region}
                                type="button"
                                onClick={() => handleRegionSelect(region)}
                                className={`mm-gallery-chip mm-exhibition-region-chip ${isActive ? 'is-active' : ''}`}
                                style={getRegionChipStyle(region)}
                            >
                                <span>{labels.regions[region]}</span>
                                <span className="mm-exhibition-region-count">{count.toLocaleString(locale)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {!error && viewItems.length > 0 && (
                <div className="relative mb-5">
                    <div className={`mm-map2-search mm-exhibition-search relative flex h-[58px] items-center gap-2.5 rounded-full px-[18px] transition-all ${isSearchFocused ? 'is-focused' : ''}`}>
                        <Search className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => {
                                setSearchQuery(event.target.value);
                                setPage(1);
                            }}
                            onPointerDown={() => primeMobileSearchChrome()}
                            onTouchStart={() => primeMobileSearchChrome()}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            placeholder={searchLabels.placeholder}
                            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-gray-800 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-blue-100/50"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setPage(1);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                                aria-label={searchLabels.clear}
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    {normalizedSearchQuery && (
                        <div className="mm-exhibition-search-results mt-2 rounded-2xl overflow-hidden border border-slate-200/80 bg-white/95 shadow-lg backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/95">
                            <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
                                <span>{searchLabels.results}</span>
                                <span>{searchFilteredItems.length.toLocaleString(locale)} {labels.count}</span>
                            </div>
                            {searchResults.length > 0 ? (
                                searchResults.map(exhibition => (
                                    <ExhibitionSearchResult
                                        key={`exhibition-search-${exhibition.id}`}
                                        exhibition={exhibition}
                                        labels={labels}
                                        locale={locale as Locale}
                                    />
                                ))
                            ) : (
                                <div className="px-4 py-5 text-center text-sm font-medium text-slate-500 dark:text-neutral-400">{searchLabels.empty}</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className={`mm-exhibition-results ${filterSettling ? 'is-filtering' : ''}`}>
                {error ? (
                    <div className="mm-exhibition-error">
                        <p>{labels.error}</p>
                        <button type="button" onClick={loadExhibitions}>{labels.retry}</button>
                    </div>
                ) : (
                    <>
                    <ExhibitionWeekCalendar
                        days={weekScheduleDays}
                        labels={weekCalendarLabels}
                        locale={locale as Locale}
                        selectedDay={selectedWeekDay}
                        onSelectDay={setSelectedWeekDateOnly}
                        onCloseDay={() => setSelectedWeekDateOnly(null)}
                    />

                    <div className="mm-section-heading">
                        <h2>{labels.question}</h2>
                        <div className="mm-exhibition-carousel-actions">
                            <span>{normalizedSearchQuery ? searchLabels.scope : labels.regions[activeRegion]}</span>
                            {featuredItems.length > 1 && (
                                <button type="button" onClick={() => setFeatureSeed(Date.now())} aria-label={labels.shuffle || labels.question} className="mm-exhibition-carousel-action">
                                    <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                    {featuredItems.length > 0 ? (
                        <div className="mm-rail-scroll mm-exhibition-feature-rail mm-exhibition-recommend-rail stagger-children" data-no-swipe-back>
                            {featuredItems.map(exhibition => (
                                <ExhibitionCard
                                    key={`feature-${exhibition.id}`}
                                    exhibition={exhibition}
                                    labels={labels}
                                    locale={locale as Locale}
                                    todayDateOnly={todayDateOnly}
                                    rail
                                    featured
                                />
                            ))}
                        </div>
                    ) : (
                        <ExhibitionEmptyState title={labels.emptyQuestion || labels.emptyAll} body={emptyBody} compact />
                    )}

                    <div className="mm-section-heading">
                        <h2>{labels.endingSoon}</h2>
                        <span>{endingSoonItems.length.toLocaleString(locale)} {labels.count}</span>
                    </div>
                    {endingSoonItems.length > 0 ? (
                        <div className="mm-rail-scroll mm-exhibition-feature-rail stagger-children">
                            {endingSoonItems.map(exhibition => (
                                <ExhibitionCard
                                    key={`soon-${exhibition.id}`}
                                    exhibition={exhibition}
                                    labels={labels}
                                    locale={locale as Locale}
                                    todayDateOnly={todayDateOnly}
                                    rail
                                    endingSoon
                                />
                            ))}
                        </div>
                    ) : (
                        <ExhibitionEmptyState title={labels.emptySoon || labels.emptyAll} compact />
                    )}

                    <div className="mm-section-heading">
                        <h2>{labels.startingSoon}</h2>
                        <span>{startingSoonItems.length.toLocaleString(locale)} {labels.count}</span>
                    </div>
                    {startingSoonItems.length > 0 ? (
                        <div className="mm-rail-scroll mm-exhibition-feature-rail stagger-children">
                            {startingSoonItems.map(exhibition => (
                                <ExhibitionCard
                                    key={`starting-${exhibition.id}`}
                                    exhibition={exhibition}
                                    labels={labels}
                                    locale={locale as Locale}
                                    todayDateOnly={todayDateOnly}
                                    rail
                                    startingSoon
                                />
                            ))}
                        </div>
                    ) : (
                        <ExhibitionEmptyState title={labels.emptyStartingSoon || labels.emptyAll} compact />
                    )}

                    <div className="mm-section-heading">
                        <h2>{labels.allList}</h2>
                        <div className="flex items-center gap-2">
                            <span>{sortedListItems.length.toLocaleString(locale)} {labels.count}</span>
                            <select
                                value={sortMode}
                                onChange={(event) => handleSortChange(event.target.value as ExhibitionSortMode)}
                                className="mm-gallery-chip cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                {(['random', 'endingSoon', 'startingSoon', 'distance'] as ExhibitionSortMode[]).map(mode => (
                                    <option key={mode} value={mode}>{getSortLabel(mode, locale)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {sortedListItems.length > 0 ? (
                        <div className="mm-exhibition-card-grid stagger-children">
                            {paginatedListItems.map(exhibition => (
                                <ExhibitionCard
                                    key={exhibition.id}
                                    exhibition={exhibition}
                                    labels={labels}
                                    locale={locale as Locale}
                                    todayDateOnly={todayDateOnly}
                                />
                            ))}
                        </div>
                    ) : (
                        <ExhibitionEmptyState title={allEmptyTitle} body={emptyBody} />
                    )}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-1.5 mt-10 mb-4">
                            <button
                                type="button"
                                onClick={() => goToPage(1)}
                                disabled={page === 1}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                aria-label="First page"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(page - 1)}
                                disabled={page === 1}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                aria-label="Previous page"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            {(() => {
                                const maxVisible = 5;
                                let start = Math.max(1, page - Math.floor(maxVisible / 2));
                                const end = Math.min(totalPages, start + maxVisible - 1);
                                if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                                return Array.from({ length: end - start + 1 }, (_, index) => start + index).map(pageNumber => (
                                    <button
                                        key={pageNumber}
                                        type="button"
                                        onClick={() => goToPage(pageNumber)}
                                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${pageNumber === page
                                            ? 'gradient-btn text-white shadow-md'
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                        }`}
                                    >
                                        {pageNumber}
                                    </button>
                                ));
                            })()}
                            <button
                                type="button"
                                onClick={() => goToPage(page + 1)}
                                disabled={page === totalPages}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                aria-label="Next page"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => goToPage(totalPages)}
                                disabled={page === totalPages}
                                className="px-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                                aria-label="Last page"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    )}
                    </>
                )}
            </div>
        </div>
    );
}
