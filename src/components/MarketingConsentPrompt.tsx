'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';

// GDPR-compliant marketing consent texts (13 locales)
const CONSENT_TEXTS: Record<string, { title: string; body: string }> = {
    ko: {
        title: '마케팅 정보 수신 동의',
        body: '새로운 전시, 이벤트, 추천 미술관 소식을 앱 안에서 받아볼 수 있어요.\n\n수신 내용: 새 전시·이벤트 안내, 관심 미술관 추천\n수신 방법: 앱 내 알림\n이용 정보: 저장한 미술관, 관심 지역\n철회 방법: 설정에서 언제든 해제 가능\n\n동의하지 않아도 서비스 이용에는 제한이 없습니다.',
    },
    en: {
        title: 'Marketing Communications',
        body: 'You can receive updates about new exhibitions, events, and recommended museums inside the app.\n\nContent: New exhibition and event updates, museum recommendations\nMethod: In-app notifications\nData used: Saved museums and areas of interest\nWithdrawal: You can opt out anytime in Settings\n\nYou can still use the service without agreeing.',
    },
    ja: {
        title: 'マーケティング情報受信の同意',
        body: '新しい展覧会、イベント、おすすめ美術館のお知らせをアプリ内で受け取れます。\n\n受信内容：新しい展覧会・イベントのお知らせ、おすすめ美術館\n受信方法：アプリ内通知\n利用情報：保存した美術館、関心地域\n撤回方法：設定からいつでも解除可能\n\n同意しなくてもサービス利用に制限はありません。',
    },
    de: { title: 'Marketing-Einwilligung', body: 'Sie können Hinweise zu neuen Ausstellungen, Veranstaltungen und Museumsempfehlungen in der App erhalten.\n\nInhalt: Neue Ausstellungen, Veranstaltungen, Empfehlungen\nMethode: In-App-Benachrichtigungen\nGenutzte Daten: Gespeicherte Museen und Interessengebiete\nWiderruf: Jederzeit in den Einstellungen\n\nDer Service ist auch ohne Zustimmung nutzbar.' },
    fr: { title: 'Consentement marketing', body: 'Vous pouvez recevoir dans l’app des nouvelles expositions, événements et recommandations de musées.\n\nContenu : Expositions, événements, recommandations\nMéthode : Notifications dans l’app\nDonnées utilisées : Musées enregistrés et zones d’intérêt\nRetrait : À tout moment dans les paramètres\n\nLe service reste accessible sans consentement.' },
    es: { title: 'Consentimiento de marketing', body: 'Puedes recibir en la app novedades sobre exposiciones, eventos y museos recomendados.\n\nContenido: Exposiciones, eventos y recomendaciones\nMétodo: Notificaciones en la app\nDatos usados: Museos guardados y zonas de interés\nRevocación: En cualquier momento desde Ajustes\n\nPuedes usar el servicio sin aceptar.' },
    pt: { title: 'Consentimento de marketing', body: 'Você pode receber no app novidades sobre exposições, eventos e museus recomendados.\n\nConteúdo: Exposições, eventos e recomendações\nMétodo: Notificações no app\nDados usados: Museus salvos e áreas de interesse\nRevogação: A qualquer momento nas Configurações\n\nVocê pode usar o serviço sem consentir.' },
    'zh-CN': { title: '营销通讯同意', body: '您可以在应用内接收新展览、活动和推荐博物馆消息。\n\n接收内容：新展览、活动通知和博物馆推荐\n接收方式：应用内通知\n使用信息：已保存的博物馆和感兴趣地区\n撤回方式：可随时在设置中取消\n\n不同意也不影响服务使用。' },
    'zh-TW': { title: '行銷通訊同意', body: '您可以在應用程式內接收新展覽、活動和推薦博物館消息。\n\n接收內容：新展覽、活動通知和博物館推薦\n接收方式：應用程式內通知\n使用資訊：已儲存的博物館和感興趣地區\n撤回方式：可隨時在設定中取消\n\n不同意也不影響服務使用。' },
    da: { title: 'Marketing-samtykke', body: 'Du kan modtage nyheder om udstillinger, events og anbefalede museer i appen.\n\nIndhold: Nye udstillinger, events og anbefalinger\nMetode: Notifikationer i appen\nData: Gemte museer og interesseområder\nTilbagetrækning: Når som helst i Indstillinger\n\nTjenesten kan bruges uden samtykke.' },
    fi: { title: 'Markkinointisuostumus', body: 'Voit saada sovelluksessa ilmoituksia uusista näyttelyistä, tapahtumista ja museosuosituksista.\n\nSisältö: Näyttelyt, tapahtumat ja suositukset\nTapa: Sovelluksen sisäiset ilmoitukset\nKäytetyt tiedot: Tallennetut museot ja kiinnostavat alueet\nPeruutus: Milloin tahansa asetuksissa\n\nPalvelu on käytettävissä ilman suostumusta.' },
    sv: { title: 'Marknadsföringssamtycke', body: 'Du kan få uppdateringar om nya utställningar, evenemang och museirekommendationer i appen.\n\nInnehåll: Utställningar, evenemang och rekommendationer\nMetod: Notiser i appen\nData som används: Sparade museer och intresseområden\nÅterkallelse: När som helst i Inställningar\n\nTjänsten kan användas utan samtycke.' },
    et: { title: 'Turundusnõusolek', body: 'Rakenduses saab saada teateid uute näituste, sündmuste ja muuseumisoovituste kohta.\n\nSisu: Näitused, sündmused ja soovitused\nMeetod: Rakendusesisesed teated\nKasutatav teave: Salvestatud muuseumid ja huvipiirkonnad\nTagasivõtmine: Igal ajal seadetes\n\nTeenust saab kasutada ka nõusolekuta.' },
};

// Shows marketing consent popup once after first login/signup
export default function MarketingConsentPrompt() {
    const { data: session, status } = useSession();
    const { locale } = useApp();
    const { showConfirm } = useModal();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (status !== 'authenticated' || checked) return;
        if (!session?.user?.email || session.user.name?.startsWith('guest_')) return;

        // Only ask once per device
        const asked = localStorage.getItem('marketing_consent_asked');
        if (asked) { setChecked(true); return; }

        // Check if user already has consent set
        fetch('/api/me/consent')
            .then(r => r.json())
            .then(data => {
                setChecked(true);
                // If marketing consent is already true, don't ask
                if (data.marketingConsent) {
                    localStorage.setItem('marketing_consent_asked', 'true');
                    return;
                }
                // Show consent popup after a short delay for UX
                const texts = CONSENT_TEXTS[locale] || CONSENT_TEXTS['en'];
                setTimeout(() => {
                    showConfirm(texts.body, () => {
                        fetch('/api/me/consent', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ marketingConsent: true })
                        });
                        localStorage.setItem('marketing_consent_asked', 'true');
                    }, texts.title);
                    localStorage.setItem('marketing_consent_asked', 'true');
                }, 1500);
            })
            .catch(() => setChecked(true));
    }, [status, session, checked, locale, showConfirm]);

    return null;
}
