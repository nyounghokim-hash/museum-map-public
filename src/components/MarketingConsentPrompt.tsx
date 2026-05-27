'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import { useModal } from '@/components/ui/Modal';

// GDPR-compliant marketing consent texts (13 locales)
const CONSENT_TEXTS: Record<string, { title: string; body: string }> = {
    ko: {
        title: '마케팅 정보 수신 동의',
        body: '새로운 전시·이벤트 안내, 추천 미술관 소식을\n앱 내 알림으로 받아보시겠어요?\n\n· 저장한 미술관, 관심 지역 기반 맞춤 알림\n· 설정에서 언제든 해제 가능\n\n* 동의하지 않아도 서비스 이용에 제한이 없습니다.',
    },
    en: {
        title: 'Marketing Communications',
        body: 'Do you agree to receive the following?\n\n· Content: New exhibition & event announcements, museum recommendations\n· Method: In-app notifications\n· Data used: Saved museums, areas of interest\n· Withdrawal: You can opt out anytime in Settings\n\n* You may use the service without consent.',
    },
    ja: {
        title: 'マーケティング情報受信の同意',
        body: '以下の内容に同意しますか？\n\n· 受信内容：新しい展覧会・イベントのお知らせ、おすすめ美術館\n· 受信方法：アプリ内通知\n· 利用情報：保存した美術館、関心地域\n· 撤回方法：設定ページからいつでも解除可能\n\n※ 同意しなくてもサービス利用に制限はありません。',
    },
    de: { title: 'Marketing-Einwilligung', body: 'Stimmen Sie dem Erhalt folgender Mitteilungen zu?\n\n· Inhalt: Neue Ausstellungen, Veranstaltungen, Empfehlungen\n· Methode: In-App-Benachrichtigungen\n· Widerruf: Jederzeit in den Einstellungen\n\n* Der Service ist auch ohne Zustimmung nutzbar.' },
    fr: { title: 'Consentement marketing', body: 'Acceptez-vous de recevoir:\n\n· Contenu: Nouvelles expositions, événements\n· Méthode: Notifications in-app\n· Retrait: À tout moment dans les paramètres\n\n* Le service reste accessible sans consentement.' },
    es: { title: 'Consentimiento de marketing', body: '¿Acepta recibir notificaciones de nuevas exposiciones y eventos?\n\n· Método: Notificaciones en la app\n· Revocación: En cualquier momento desde Ajustes\n\n* El servicio es accesible sin consentimiento.' },
    pt: { title: 'Consentimento de marketing', body: 'Você concorda em receber notificações sobre novas exposições?\n\n· Método: Notificações no app\n· Revogação: A qualquer momento nas Configurações\n\n* O serviço pode ser usado sem consentimento.' },
    'zh-CN': { title: '营销通讯同意', body: '您是否同意接收新展览和活动的通知？\n\n· 方式：应用内通知\n· 撤回：可随时在设置中取消\n\n* 不同意也不影响服务使用。' },
    'zh-TW': { title: '行銷通訊同意', body: '您是否同意接收新展覽和活動的通知？\n\n· 方式：應用內通知\n· 撤回：可隨時在設定中取消\n\n* 不同意也不影響服務使用。' },
    da: { title: 'Marketing-samtykke', body: 'Accepterer du at modtage notifikationer?\n\n· Tilbagetrækning: Når som helst i Indstillinger\n\n* Tjenesten kan bruges uden samtykke.' },
    fi: { title: 'Markkinointisuostumus', body: 'Hyväksytkö ilmoitukset uusista näyttelyistä?\n\n· Peruutus: Milloin tahansa asetuksissa\n\n* Palvelu on käytettävissä ilman suostumusta.' },
    sv: { title: 'Marknadsföringssamtycke', body: 'Godkänner du meddelanden om nya utställningar?\n\n· Återkallelse: När som helst i Inställningar\n\n* Tjänsten kan användas utan samtycke.' },
    et: { title: 'Turundusnõusolek', body: 'Kas nõustute saama teateid uutest näitustest?\n\n· Tagasivõtmine: Igal ajal seadetes\n\n* Teenust saab kasutada ilma nõusolekuta.' },
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
