// Country code to localized name mapping
// ISO 3166-1 alpha-2 country codes

const COUNTRY_NAMES: Record<string, Record<string, string>> = {
    AF: { en: 'Afghanistan', ko: '아프가니스탄', ja: 'アフガニスタン', zh: '阿富汗', de: 'Afghanistan', fr: 'Afghanistan', es: 'Afganistán' },
    AQ: { en: 'Antarctica', ko: '남극', ja: '南極', zh: '南极洲', de: 'Antarktis', fr: 'Antarctique', es: 'Antártida' },
    AL: { en: 'Albania', ko: '알바니아', ja: 'アルバニア', zh: '阿尔巴尼亚', de: 'Albanien', fr: 'Albanie', es: 'Albania' },
    DZ: { en: 'Algeria', ko: '알제리', ja: 'アルジェリア', zh: '阿尔及利亚', de: 'Algerien', fr: 'Algérie', es: 'Argelia' },
    AR: { en: 'Argentina', ko: '아르헨티나', ja: 'アルゼンチン', zh: '阿根廷', de: 'Argentinien', fr: 'Argentine', es: 'Argentina' },
    AM: { en: 'Armenia', ko: '아르메니아', ja: 'アルメニア', zh: '亚美尼亚', de: 'Armenien', fr: 'Arménie', es: 'Armenia' },
    AU: { en: 'Australia', ko: '호주', ja: 'オーストラリア', zh: '澳大利亚', de: 'Australien', fr: 'Australie', es: 'Australia' },
    AT: { en: 'Austria', ko: '오스트리아', ja: 'オーストリア', zh: '奥地利', de: 'Österreich', fr: 'Autriche', es: 'Austria' },
    AZ: { en: 'Azerbaijan', ko: '아제르바이잔', ja: 'アゼルバイジャン', zh: '阿塞拜疆', de: 'Aserbaidschan', fr: 'Azerbaïdjan', es: 'Azerbaiyán' },
    BE: { en: 'Belgium', ko: '벨기에', ja: 'ベルギー', zh: '比利时', de: 'Belgien', fr: 'Belgique', es: 'Bélgica' },
    BA: { en: 'Bosnia and Herzegovina', ko: '보스니아 헤르체고비나', ja: 'ボスニア・ヘルツェゴビナ', zh: '波斯尼亚和黑塞哥维那', de: 'Bosnien und Herzegowina', fr: 'Bosnie-Herzégovine', es: 'Bosnia y Herzegovina' },
    BR: { en: 'Brazil', ko: '브라질', ja: 'ブラジル', zh: '巴西', de: 'Brasilien', fr: 'Brésil', es: 'Brasil' },
    BG: { en: 'Bulgaria', ko: '불가리아', ja: 'ブルガリア', zh: '保加利亚', de: 'Bulgarien', fr: 'Bulgarie', es: 'Bulgaria' },
    CA: { en: 'Canada', ko: '캐나다', ja: 'カナダ', zh: '加拿大', de: 'Kanada', fr: 'Canada', es: 'Canadá' },
    CL: { en: 'Chile', ko: '칠레', ja: 'チリ', zh: '智利', de: 'Chile', fr: 'Chili', es: 'Chile' },
    CN: { en: 'China', ko: '중국', ja: '中国', zh: '中国', de: 'China', fr: 'Chine', es: 'China' },
    CO: { en: 'Colombia', ko: '콜롬비아', ja: 'コロンビア', zh: '哥伦比亚', de: 'Kolumbien', fr: 'Colombie', es: 'Colombia' },
    HR: { en: 'Croatia', ko: '크로아티아', ja: 'クロアチア', zh: '克罗地亚', de: 'Kroatien', fr: 'Croatie', es: 'Croacia' },
    CU: { en: 'Cuba', ko: '쿠바', ja: 'キューバ', zh: '古巴', de: 'Kuba', fr: 'Cuba', es: 'Cuba' },
    CY: { en: 'Cyprus', ko: '키프로스', ja: 'キプロス', zh: '塞浦路斯', de: 'Zypern', fr: 'Chypre', es: 'Chipre' },
    CZ: { en: 'Czech Republic', ko: '체코', ja: 'チェコ', zh: '捷克', de: 'Tschechien', fr: 'Tchéquie', es: 'Chequia' },
    DK: { en: 'Denmark', ko: '덴마크', ja: 'デンマーク', zh: '丹麦', de: 'Dänemark', fr: 'Danemark', es: 'Dinamarca' },
    EC: { en: 'Ecuador', ko: '에콰도르', ja: 'エクアドル', zh: '厄瓜多尔', de: 'Ecuador', fr: 'Équateur', es: 'Ecuador' },
    EG: { en: 'Egypt', ko: '이집트', ja: 'エジプト', zh: '埃及', de: 'Ägypten', fr: 'Égypte', es: 'Egipto' },
    EE: { en: 'Estonia', ko: '에스토니아', ja: 'エストニア', zh: '爱沙尼亚', de: 'Estland', fr: 'Estonie', es: 'Estonia' },
    FI: { en: 'Finland', ko: '핀란드', ja: 'フィンランド', zh: '芬兰', de: 'Finnland', fr: 'Finlande', es: 'Finlandia' },
    FR: { en: 'France', ko: '프랑스', ja: 'フランス', zh: '法国', de: 'Frankreich', fr: 'France', es: 'Francia' },
    GE: { en: 'Georgia', ko: '조지아', ja: 'ジョージア', zh: '格鲁吉亚', de: 'Georgien', fr: 'Géorgie', es: 'Georgia' },
    DE: { en: 'Germany', ko: '독일', ja: 'ドイツ', zh: '德国', de: 'Deutschland', fr: 'Allemagne', es: 'Alemania' },
    GL: { en: 'Greenland', ko: '그린란드', ja: 'グリーンランド', zh: '格陵兰', de: 'Grönland', fr: 'Groenland', es: 'Groenlandia' },
    GR: { en: 'Greece', ko: '그리스', ja: 'ギリシャ', zh: '希腊', de: 'Griechenland', fr: 'Grèce', es: 'Grecia' },
    HU: { en: 'Hungary', ko: '헝가리', ja: 'ハンガリー', zh: '匈牙利', de: 'Ungarn', fr: 'Hongrie', es: 'Hungría' },
    IS: { en: 'Iceland', ko: '아이슬란드', ja: 'アイスランド', zh: '冰岛', de: 'Island', fr: 'Islande', es: 'Islandia' },
    IN: { en: 'India', ko: '인도', ja: 'インド', zh: '印度', de: 'Indien', fr: 'Inde', es: 'India' },
    ID: { en: 'Indonesia', ko: '인도네시아', ja: 'インドネシア', zh: '印度尼西亚', de: 'Indonesien', fr: 'Indonésie', es: 'Indonesia' },
    IR: { en: 'Iran', ko: '이란', ja: 'イラン', zh: '伊朗', de: 'Iran', fr: 'Iran', es: 'Irán' },
    IQ: { en: 'Iraq', ko: '이라크', ja: 'イラク', zh: '伊拉克', de: 'Irak', fr: 'Irak', es: 'Irak' },
    IE: { en: 'Ireland', ko: '아일랜드', ja: 'アイルランド', zh: '爱尔兰', de: 'Irland', fr: 'Irlande', es: 'Irlanda' },
    IL: { en: 'Israel', ko: '이스라엘', ja: 'イスラエル', zh: '以色列', de: 'Israel', fr: 'Israël', es: 'Israel' },
    IT: { en: 'Italy', ko: '이탈리아', ja: 'イタリア', zh: '意大利', de: 'Italien', fr: 'Italie', es: 'Italia' },
    JP: { en: 'Japan', ko: '일본', ja: '日本', zh: '日本', de: 'Japan', fr: 'Japon', es: 'Japón' },
    JO: { en: 'Jordan', ko: '요르단', ja: 'ヨルダン', zh: '约旦', de: 'Jordanien', fr: 'Jordanie', es: 'Jordania' },
    KZ: { en: 'Kazakhstan', ko: '카자흐스탄', ja: 'カザフスタン', zh: '哈萨克斯坦', de: 'Kasachstan', fr: 'Kazakhstan', es: 'Kazajistán' },
    KE: { en: 'Kenya', ko: '케냐', ja: 'ケニア', zh: '肯尼亚', de: 'Kenia', fr: 'Kenya', es: 'Kenia' },
    KR: { en: 'South Korea', ko: '대한민국', ja: '韓国', zh: '韩国', de: 'Südkorea', fr: 'Corée du Sud', es: 'Corea del Sur' },
    KW: { en: 'Kuwait', ko: '쿠웨이트', ja: 'クウェート', zh: '科威特', de: 'Kuwait', fr: 'Koweït', es: 'Kuwait' },
    LV: { en: 'Latvia', ko: '라트비아', ja: 'ラトビア', zh: '拉脱维亚', de: 'Lettland', fr: 'Lettonie', es: 'Letonia' },
    LB: { en: 'Lebanon', ko: '레바논', ja: 'レバノン', zh: '黎巴嫩', de: 'Libanon', fr: 'Liban', es: 'Líbano' },
    LT: { en: 'Lithuania', ko: '리투아니아', ja: 'リトアニア', zh: '立陶宛', de: 'Litauen', fr: 'Lituanie', es: 'Lituania' },
    LU: { en: 'Luxembourg', ko: '룩셈부르크', ja: 'ルクセンブルク', zh: '卢森堡', de: 'Luxemburg', fr: 'Luxembourg', es: 'Luxemburgo' },
    MY: { en: 'Malaysia', ko: '말레이시아', ja: 'マレーシア', zh: '马来西亚', de: 'Malaysia', fr: 'Malaisie', es: 'Malasia' },
    MT: { en: 'Malta', ko: '몰타', ja: 'マルタ', zh: '马耳他', de: 'Malta', fr: 'Malte', es: 'Malta' },
    MX: { en: 'Mexico', ko: '멕시코', ja: 'メキシコ', zh: '墨西哥', de: 'Mexiko', fr: 'Mexique', es: 'México' },
    MA: { en: 'Morocco', ko: '모로코', ja: 'モロッコ', zh: '摩洛哥', de: 'Marokko', fr: 'Maroc', es: 'Marruecos' },
    NL: { en: 'Netherlands', ko: '네덜란드', ja: 'オランダ', zh: '荷兰', de: 'Niederlande', fr: 'Pays-Bas', es: 'Países Bajos' },
    NZ: { en: 'New Zealand', ko: '뉴질랜드', ja: 'ニュージーランド', zh: '新西兰', de: 'Neuseeland', fr: 'Nouvelle-Zélande', es: 'Nueva Zelanda' },
    NG: { en: 'Nigeria', ko: '나이지리아', ja: 'ナイジェリア', zh: '尼日利亚', de: 'Nigeria', fr: 'Nigéria', es: 'Nigeria' },
    NO: { en: 'Norway', ko: '노르웨이', ja: 'ノルウェー', zh: '挪威', de: 'Norwegen', fr: 'Norvège', es: 'Noruega' },
    PK: { en: 'Pakistan', ko: '파키스탄', ja: 'パキスタン', zh: '巴基斯坦', de: 'Pakistan', fr: 'Pakistan', es: 'Pakistán' },
    PE: { en: 'Peru', ko: '페루', ja: 'ペルー', zh: '秘鲁', de: 'Peru', fr: 'Pérou', es: 'Perú' },
    PH: { en: 'Philippines', ko: '필리핀', ja: 'フィリピン', zh: '菲律宾', de: 'Philippinen', fr: 'Philippines', es: 'Filipinas' },
    PL: { en: 'Poland', ko: '폴란드', ja: 'ポーランド', zh: '波兰', de: 'Polen', fr: 'Pologne', es: 'Polonia' },
    PT: { en: 'Portugal', ko: '포르투갈', ja: 'ポルトガル', zh: '葡萄牙', de: 'Portugal', fr: 'Portugal', es: 'Portugal' },
    QA: { en: 'Qatar', ko: '카타르', ja: 'カタール', zh: '卡塔尔', de: 'Katar', fr: 'Qatar', es: 'Catar' },
    RO: { en: 'Romania', ko: '루마니아', ja: 'ルーマニア', zh: '罗马尼亚', de: 'Rumänien', fr: 'Roumanie', es: 'Rumanía' },
    RU: { en: 'Russia', ko: '러시아', ja: 'ロシア', zh: '俄罗斯', de: 'Russland', fr: 'Russie', es: 'Rusia' },
    SA: { en: 'Saudi Arabia', ko: '사우디아라비아', ja: 'サウジアラビア', zh: '沙特阿拉伯', de: 'Saudi-Arabien', fr: 'Arabie saoudite', es: 'Arabia Saudita' },
    RS: { en: 'Serbia', ko: '세르비아', ja: 'セルビア', zh: '塞尔维亚', de: 'Serbien', fr: 'Serbie', es: 'Serbia' },
    SG: { en: 'Singapore', ko: '싱가포르', ja: 'シンガポール', zh: '新加坡', de: 'Singapur', fr: 'Singapour', es: 'Singapur' },
    SK: { en: 'Slovakia', ko: '슬로바키아', ja: 'スロバキア', zh: '斯洛伐克', de: 'Slowakei', fr: 'Slovaquie', es: 'Eslovaquia' },
    SI: { en: 'Slovenia', ko: '슬로베니아', ja: 'スロベニア', zh: '斯洛文尼亚', de: 'Slowenien', fr: 'Slovénie', es: 'Eslovenia' },
    ZA: { en: 'South Africa', ko: '남아프리카', ja: '南アフリカ', zh: '南非', de: 'Südafrika', fr: 'Afrique du Sud', es: 'Sudáfrica' },
    ES: { en: 'Spain', ko: '스페인', ja: 'スペイン', zh: '西班牙', de: 'Spanien', fr: 'Espagne', es: 'España' },
    SE: { en: 'Sweden', ko: '스웨덴', ja: 'スウェーデン', zh: '瑞典', de: 'Schweden', fr: 'Suède', es: 'Suecia' },
    CH: { en: 'Switzerland', ko: '스위스', ja: 'スイス', zh: '瑞士', de: 'Schweiz', fr: 'Suisse', es: 'Suiza' },
    TW: { en: 'Taiwan', ko: '대만', ja: '台湾', zh: '台湾', de: 'Taiwan', fr: 'Taïwan', es: 'Taiwán' },
    TH: { en: 'Thailand', ko: '태국', ja: 'タイ', zh: '泰国', de: 'Thailand', fr: 'Thaïlande', es: 'Tailandia' },
    TR: { en: 'Turkey', ko: '튀르키예', ja: 'トルコ', zh: '土耳其', de: 'Türkei', fr: 'Turquie', es: 'Turquía' },
    UA: { en: 'Ukraine', ko: '우크라이나', ja: 'ウクライナ', zh: '乌克兰', de: 'Ukraine', fr: 'Ukraine', es: 'Ucrania' },
    AE: { en: 'United Arab Emirates', ko: '아랍에미리트', ja: 'アラブ首長国連邦', zh: '阿联酋', de: 'Vereinigte Arabische Emirate', fr: 'Émirats arabes unis', es: 'Emiratos Árabes Unidos' },
    GB: { en: 'United Kingdom', ko: '영국', ja: 'イギリス', zh: '英国', de: 'Vereinigtes Königreich', fr: 'Royaume-Uni', es: 'Reino Unido' },
    US: { en: 'United States', ko: '미국', ja: 'アメリカ', zh: '美国', de: 'Vereinigte Staaten', fr: 'États-Unis', es: 'Estados Unidos' },
    UY: { en: 'Uruguay', ko: '우루과이', ja: 'ウルグアイ', zh: '乌拉圭', de: 'Uruguay', fr: 'Uruguay', es: 'Uruguay' },
    UZ: { en: 'Uzbekistan', ko: '우즈베키스탄', ja: 'ウズベキスタン', zh: '乌兹别克斯坦', de: 'Usbekistan', fr: 'Ouzbékistan', es: 'Uzbekistán' },
    VE: { en: 'Venezuela', ko: '베네수엘라', ja: 'ベネズエラ', zh: '委内瑞拉', de: 'Venezuela', fr: 'Venezuela', es: 'Venezuela' },
    VN: { en: 'Vietnam', ko: '베트남', ja: 'ベトナム', zh: '越南', de: 'Vietnam', fr: 'Viêt Nam', es: 'Vietnam' },
    MK: { en: 'North Macedonia', ko: '북마케도니아', ja: '北マケドニア', zh: '北马其顿', de: 'Nordmazedonien', fr: 'Macédoine du Nord', es: 'Macedonia del Norte' },
    ME: { en: 'Montenegro', ko: '몬테네그로', ja: 'モンテネグロ', zh: '黑山', de: 'Montenegro', fr: 'Monténégro', es: 'Montenegro' },
    MD: { en: 'Moldova', ko: '몰도바', ja: 'モルドバ', zh: '摩尔多瓦', de: 'Moldau', fr: 'Moldavie', es: 'Moldavia' },
    MC: { en: 'Monaco', ko: '모나코', ja: 'モナコ', zh: '摩纳哥', de: 'Monaco', fr: 'Monaco', es: 'Mónaco' },
    LI: { en: 'Liechtenstein', ko: '리히텐슈타인', ja: 'リヒテンシュタイン', zh: '列支敦士登', de: 'Liechtenstein', fr: 'Liechtenstein', es: 'Liechtenstein' },
    SM: { en: 'San Marino', ko: '산마리노', ja: 'サンマリノ', zh: '圣马力诺', de: 'San Marino', fr: 'Saint-Marin', es: 'San Marino' },
    VA: { en: 'Vatican City', ko: '바티칸', ja: 'バチカン', zh: '梵蒂冈', de: 'Vatikanstadt', fr: 'Vatican', es: 'Ciudad del Vaticano' },
    AD: { en: 'Andorra', ko: '안도라', ja: 'アンドラ', zh: '安道尔', de: 'Andorra', fr: 'Andorre', es: 'Andorra' },
    BY: { en: 'Belarus', ko: '벨라루스', ja: 'ベラルーシ', zh: '白俄罗斯', de: 'Belarus', fr: 'Biélorussie', es: 'Bielorrusia' },
    XK: { en: 'Kosovo', ko: '코소보', ja: 'コソボ', zh: '科索沃', de: 'Kosovo', fr: 'Kosovo', es: 'Kosovo' },
};

// US state codes that could be confused with ISO country codes
const US_STATE_CODES = new Set([
    'AL', // Alabama (vs Albania)
    'AR', // Arkansas (vs Argentina) 
    'CA', // California (vs Canada)
    'CO', // Colorado (vs Colombia)
    'CT', // Connecticut
    'DE', // Delaware (vs Germany!)
    'FL', // Florida
    'GA', // Georgia (vs Georgia country!)
    'HI', // Hawaii
    'IA', // Iowa
    'ID', // Idaho (vs Indonesia!)
    'IL', // Illinois (vs Israel!)
    'IN', // Indiana (vs India!)
    'KS', // Kansas
    'KY', // Kentucky
    'LA', // Louisiana (vs Laos!)
    'MA', // Massachusetts (vs Morocco!)
    'MD', // Maryland (vs Moldova!)
    'ME', // Maine (vs Montenegro!)
    'MI', // Michigan
    'MN', // Minnesota
    'MO', // Missouri
    'MS', // Mississippi
    'MT', // Montana (vs Malta!)
    'NC', // North Carolina
    'ND', // North Dakota
    'NE', // Nebraska (vs Niger!)
    'NH', // New Hampshire
    'NJ', // New Jersey
    'NM', // New Mexico
    'NV', // Nevada
    'NY', // New York
    'OH', // Ohio
    'OK', // Oklahoma
    'OR', // Oregon
    'PA', // Pennsylvania (vs Panama!)
    'RI', // Rhode Island
    'SC', // South Carolina
    'SD', // South Dakota
    'TN', // Tennessee
    'TX', // Texas
    'UT', // Utah
    'VA', // Virginia (vs Vatican City!)
    'VT', // Vermont
    'WA', // Washington
    'WI', // Wisconsin
    'WV', // West Virginia
    'WY', // Wyoming
]);

/**
 * Get localized country name for an ISO 3166-1 alpha-2 code.
 * @param code ISO country code (e.g., "FI")
 * @param locale Target locale (e.g., "ko", "en", "ja")
 * @returns Localized country name or the original code if not found
 */
export function getCountryName(code: string, locale: string = 'en'): string {
    if (!code) return '';
    const upper = code.toUpperCase();
    const names = COUNTRY_NAMES[upper];
    if (!names) return code;

    // Map locale prefixes
    const langKey = locale.startsWith('ko') ? 'ko'
        : locale.startsWith('ja') ? 'ja'
            : locale.startsWith('zh') ? 'zh'
                : locale.startsWith('de') ? 'de'
                    : locale.startsWith('fr') ? 'fr'
                        : locale.startsWith('es') ? 'es'
                            : 'en';

    return names[langKey] || names['en'] || code;
}

/**
 * Check if a given code is potentially a US state code that conflicts with an ISO country code.
 * This helps identify data quality issues where US state abbreviations were used instead of country codes.
 */
export function isAmbiguousCode(code: string): boolean {
    return US_STATE_CODES.has(code.toUpperCase()) && !!COUNTRY_NAMES[code.toUpperCase()];
}

/**
 * Get the list of ambiguous codes (both US state and ISO country)
 */
export function getAmbiguousCodes(): string[] {
    return Array.from(US_STATE_CODES).filter(code => !!COUNTRY_NAMES[code]);
}

const CITY_NAMES: Record<string, Record<string, string>> = {
    'Berlin': { ko: '베를린', ja: 'ベルリン', zh: '柏林' },
    'Buenos Aires': { ko: '부에노스아이레스', ja: 'ブエノスアイレス', zh: '布宜诺斯艾利斯' },
    'Tel Aviv': { ko: '텔아비브', ja: 'テルアビブ', zh: '特拉维夫' },
    'Prague': { ko: '프라하', ja: 'プラハ', zh: '布拉格', de: 'Prag' },
    'Paris': { ko: '파리', ja: 'パリ', zh: '巴黎' },
    'Vienna': { ko: '비엔나', ja: 'ウィーン', zh: '维也纳', de: 'Wien' },
    'Antwerp': { ko: '앤트워프', ja: 'アントワープ', zh: '安特卫普', de: 'Antwerpen', fr: 'Anvers' },
    'Montreal': { ko: '몬트리올', ja: 'モントリオール', zh: '蒙特利尔' },
    'Calgary': { ko: '캘거리', ja: 'カルガリー', zh: '卡尔加里' },
    'São Paulo': { ko: '상파울루', ja: 'サンパウロ', zh: '圣保罗' },
    'Copenhagen Municipality': { ko: '코펜하겐', ja: 'コペンハーゲン', zh: '哥本哈根', en: 'Copenhagen', de: 'Kopenhagen' },
    'Vancouver': { ko: '밴쿠버', ja: 'バンクーバー', zh: '温哥华' },
    'City of Brussels': { ko: '브뤼셀', ja: 'ブリュッセル', zh: '布鲁塞尔', en: 'Brussels', de: 'Brüssel' },
    'Dublin': { ko: '더블린', ja: 'ダブリン', zh: '都柏林' },
    'Helsinki': { ko: '헬싱키', ja: 'ヘルシンキ', zh: '赫尔辛基' },
    'London': { ko: '런던', ja: 'ロンドン', zh: '伦敦' },
    'Frankfurt': { ko: '프랑크푸르트', ja: 'フランクフルト', zh: '法兰克福' },
    'New York': { ko: '뉴욕', ja: 'ニューヨーク', zh: '纽约' },
    'Dresden': { ko: '드레스덴', ja: 'ドレスデン', zh: '德累斯顿' },
    'Jerusalem': { ko: '예루살렘', ja: 'エルサレム', zh: '耶路撒冷' },
    'Rome': { ko: '로마', ja: 'ローマ', zh: '罗马', de: 'Rom' },
    'Milan': { ko: '밀라노', ja: 'ミラノ', zh: '米兰', de: 'Mailand', es: 'Milán' },
    'Florence': { ko: '피렌체', ja: 'フィレンツェ', zh: '佛罗伦萨', de: 'Florenz', it: 'Firenze' },
    'Venice': { ko: '베네치아', ja: 'ヴェネツィア', zh: '威尼斯', de: 'Venedig' },
    'Madrid': { ko: '마드리드', ja: 'マドリード', zh: '马德里' },
    'Barcelona': { ko: '바르셀로나', ja: 'バルセロナ', zh: '巴塞罗那' },
    'Amsterdam': { ko: '암스테르담', ja: 'アムステルダム', zh: '阿姆斯特丹' },
    'Munich': { ko: '뮌헨', ja: 'ミュンヘン', zh: '慕尼黑', de: 'München' },
    'Tokyo': { ko: '도쿄', ja: '東京', zh: '东京' },
    'Kyoto': { ko: '교토', ja: '京都', zh: '京都' },
    'Osaka': { ko: '오사카', ja: '大阪', zh: '大阪' },
    'Seoul': { ko: '서울', ja: 'ソウル', zh: '首尔' },
    'Beijing': { ko: '베이징', ja: '北京', zh: '北京' },
    'Shanghai': { ko: '상하이', ja: '上海', zh: '上海' },
    'Moscow': { ko: '모스크바', ja: 'モスクワ', zh: '莫斯科', de: 'Moskau' },
    'Istanbul': { ko: '이스탄불', ja: 'イスタンブール', zh: '伊斯坦布尔' },
    'Athens': { ko: '아테네', ja: 'アテネ', zh: '雅典', de: 'Athen' },
    'Warsaw': { ko: '바르샤바', ja: 'ワルシャワ', zh: '华沙', de: 'Warschau' },
    'Budapest': { ko: '부다페스트', ja: 'ブダペスト', zh: '布达佩斯' },
    'Lisbon': { ko: '리스본', ja: 'リスボン', zh: '里斯本', de: 'Lissabon', pt: 'Lisboa' },
    'Stockholm': { ko: '스톡홀름', ja: 'ストックホルム', zh: '斯德哥尔摩' },
    'Oslo': { ko: '오슬로', ja: 'オスロ', zh: '奥斯陆' },
    'Tallinn': { ko: '탈린', ja: 'タリン', zh: '塔林' },
    'Riga': { ko: '리가', ja: 'リガ', zh: '里加' },
    'Zurich': { ko: '취리히', ja: 'チューリッヒ', zh: '苏黎世', de: 'Zürich' },
    'Geneva': { ko: '제네바', ja: 'ジュネーブ', zh: '日内瓦', de: 'Genf', fr: 'Genève' },
    'Sydney': { ko: '시드니', ja: 'シドニー', zh: '悉尼' },
    'Melbourne': { ko: '멜버른', ja: 'メルボルン', zh: '墨尔本' },
    'Singapore': { ko: '싱가포르', ja: 'シンガポール', zh: '新加坡' },
    'Bangkok': { ko: '방콕', ja: 'バンコク', zh: '曼谷' },
    'Cairo': { ko: '카이로', ja: 'カイロ', zh: '开罗' },
    'Mexico City': { ko: '멕시코시티', ja: 'メキシコシティ', zh: '墨西哥城', de: 'Mexiko-Stadt', es: 'Ciudad de México' },
    'Santiago commune': { ko: '산티아고', ja: 'サンティアゴ', zh: '圣地亚哥', en: 'Santiago' },
    '7th arrondissement of Paris': { ko: '파리 7구', ja: 'パリ7区', zh: '巴黎第七区', en: 'Paris 7th', de: 'Paris 7. Arrondissement' },
    'Bezirk Mitte': { ko: '베를린 미테', ja: 'ベルリン・ミッテ', zh: '柏林米特', en: 'Berlin Mitte' },
    'Charlottenburg-Wilmersdorf': { ko: '샤를로텐부르크', ja: 'シャルロッテンブルク', zh: '夏洛滕堡' },
    'Buenos Aires Province': { ko: '부에노스아이레스 주', ja: 'ブエノスアイレス州', zh: '布宜诺斯艾利斯省', en: 'Buenos Aires Province' },
};

/**
 * Get localized city name.
 * @param city Original city name from DB
 * @param locale Target locale
 * @returns Localized city name or original if no translation exists
 */
export function getCityName(city: string, locale: string = 'en'): string {
    if (!city) return '';
    const names = CITY_NAMES[city];
    if (!names) return city;

    const langKey = locale.startsWith('ko') ? 'ko'
        : locale.startsWith('ja') ? 'ja'
            : locale.startsWith('zh') ? 'zh'
                : locale.startsWith('de') ? 'de'
                    : locale.startsWith('fr') ? 'fr'
                        : locale.startsWith('es') ? 'es'
                            : locale.startsWith('pt') ? 'pt'
                                : 'en';

    return names[langKey] || names['en'] || city;
}

export { COUNTRY_NAMES, US_STATE_CODES };
