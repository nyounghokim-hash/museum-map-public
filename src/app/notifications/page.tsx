'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useApp } from '@/components/AppContext';
import { t, formatDate, type Locale } from '@/lib/i18n';
import { useTranslatedTexts } from '@/hooks/useTranslation';
import EmptyStateGame from '@/components/ui/EmptyStateGame';

type NotificationPrefs = {
    notificationsEnabled: boolean;
    marketingConsent: boolean;
};

const NOTIFICATION_PREF_LABELS: Record<string, {
    controlsTitle: string;
    controlsDesc: string;
    notifications: string;
    notificationsDesc: string;
    marketing: string;
    marketingDesc: string;
    disabledTitle: string;
    disabledDesc: string;
}> = {
    ko: { controlsTitle: '알림 설정', controlsDesc: '받고 싶은 소식만 켜둘 수 있어요.', notifications: '알림', notificationsDesc: '서비스 소식과 계정 알림을 받아요.', marketing: '마케팅 알림', marketingDesc: '전시, 이벤트, 추천 소식을 받아요.', disabledTitle: '알림이 꺼져 있어요', disabledDesc: '알림을 켜면 새로운 소식을 다시 확인할 수 있어요.' },
    en: { controlsTitle: 'Notification settings', controlsDesc: 'Choose which updates you want to receive.', notifications: 'Notifications', notificationsDesc: 'Receive service and account updates.', marketing: 'Marketing notifications', marketingDesc: 'Receive exhibition, event, and recommendation updates.', disabledTitle: 'Notifications are off', disabledDesc: 'Turn notifications on to see new updates again.' },
    ja: { controlsTitle: '通知設定', controlsDesc: '受け取りたいお知らせだけをオンにできます。', notifications: '通知', notificationsDesc: 'サービスとアカウントのお知らせを受け取ります。', marketing: 'マーケティング通知', marketingDesc: '展覧会、イベント、おすすめ情報を受け取ります。', disabledTitle: '通知がオフです', disabledDesc: '通知をオンにすると新しいお知らせを確認できます。' },
    de: { controlsTitle: 'Benachrichtigungseinstellungen', controlsDesc: 'Wähle aus, welche Updates du erhalten möchtest.', notifications: 'Benachrichtigungen', notificationsDesc: 'Service- und Konto-Updates erhalten.', marketing: 'Marketing-Benachrichtigungen', marketingDesc: 'Ausstellungs-, Event- und Empfehlungshinweise erhalten.', disabledTitle: 'Benachrichtigungen sind aus', disabledDesc: 'Aktiviere Benachrichtigungen, um neue Updates wieder zu sehen.' },
    fr: { controlsTitle: 'Paramètres de notification', controlsDesc: 'Choisissez les mises à jour à recevoir.', notifications: 'Notifications', notificationsDesc: 'Recevoir les informations du service et du compte.', marketing: 'Notifications marketing', marketingDesc: 'Recevoir expositions, événements et recommandations.', disabledTitle: 'Les notifications sont désactivées', disabledDesc: 'Activez les notifications pour revoir les nouvelles mises à jour.' },
    es: { controlsTitle: 'Ajustes de notificaciones', controlsDesc: 'Elige qué novedades quieres recibir.', notifications: 'Notificaciones', notificationsDesc: 'Recibe avisos del servicio y de la cuenta.', marketing: 'Notificaciones de marketing', marketingDesc: 'Recibe exposiciones, eventos y recomendaciones.', disabledTitle: 'Las notificaciones están desactivadas', disabledDesc: 'Actívalas para volver a ver novedades.' },
    pt: { controlsTitle: 'Configurações de notificação', controlsDesc: 'Escolha quais atualizações deseja receber.', notifications: 'Notificações', notificationsDesc: 'Receba avisos do serviço e da conta.', marketing: 'Notificações de marketing', marketingDesc: 'Receba exposições, eventos e recomendações.', disabledTitle: 'Notificações desativadas', disabledDesc: 'Ative as notificações para ver novidades novamente.' },
    'zh-CN': { controlsTitle: '通知设置', controlsDesc: '选择你想接收的更新。', notifications: '通知', notificationsDesc: '接收服务和账户通知。', marketing: '营销通知', marketingDesc: '接收展览、活动和推荐消息。', disabledTitle: '通知已关闭', disabledDesc: '开启通知后可再次查看新消息。' },
    'zh-TW': { controlsTitle: '通知設定', controlsDesc: '選擇你想接收的更新。', notifications: '通知', notificationsDesc: '接收服務和帳號通知。', marketing: '行銷通知', marketingDesc: '接收展覽、活動和推薦消息。', disabledTitle: '通知已關閉', disabledDesc: '開啟通知後可再次查看新消息。' },
    da: { controlsTitle: 'Notifikationsindstillinger', controlsDesc: 'Vælg hvilke opdateringer du vil modtage.', notifications: 'Notifikationer', notificationsDesc: 'Modtag service- og kontoopdateringer.', marketing: 'Marketingnotifikationer', marketingDesc: 'Modtag udstillinger, events og anbefalinger.', disabledTitle: 'Notifikationer er slået fra', disabledDesc: 'Slå notifikationer til for at se nye opdateringer igen.' },
    fi: { controlsTitle: 'Ilmoitusasetukset', controlsDesc: 'Valitse, mitä päivityksiä haluat saada.', notifications: 'Ilmoitukset', notificationsDesc: 'Vastaanota palvelu- ja tilipäivityksiä.', marketing: 'Markkinointi-ilmoitukset', marketingDesc: 'Vastaanota näyttely-, tapahtuma- ja suosituspäivityksiä.', disabledTitle: 'Ilmoitukset ovat pois päältä', disabledDesc: 'Ota ilmoitukset käyttöön nähdäksesi uudet päivitykset.' },
    sv: { controlsTitle: 'Aviseringsinställningar', controlsDesc: 'Välj vilka uppdateringar du vill få.', notifications: 'Aviseringar', notificationsDesc: 'Få service- och kontouppdateringar.', marketing: 'Marknadsaviseringar', marketingDesc: 'Få utställnings-, event- och rekommendationsnyheter.', disabledTitle: 'Aviseringar är avstängda', disabledDesc: 'Slå på aviseringar för att se nya uppdateringar igen.' },
    et: { controlsTitle: 'Teavituste seaded', controlsDesc: 'Vali, milliseid uuendusi soovid saada.', notifications: 'Teavitused', notificationsDesc: 'Saa teenuse ja konto teavitusi.', marketing: 'Turundusteavitused', marketingDesc: 'Saa näituste, sündmuste ja soovituste teavitusi.', disabledTitle: 'Teavitused on välja lülitatud', disabledDesc: 'Lülita teavitused sisse, et uusi uuendusi taas näha.' },
};

const LOCAL_NOTIFICATION_PREFS_KEY = 'mm_notification_preferences';

function readLocalPrefs(): NotificationPrefs {
    if (typeof window === 'undefined') return { notificationsEnabled: true, marketingConsent: false };
    try {
        const parsed = JSON.parse(localStorage.getItem(LOCAL_NOTIFICATION_PREFS_KEY) || '{}');
        return {
            notificationsEnabled: parsed.notificationsEnabled !== false,
            marketingConsent: parsed.marketingConsent === true,
        };
    } catch {
        return { notificationsEnabled: true, marketingConsent: false };
    }
}

function writeLocalPrefs(prefs: NotificationPrefs) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [prefs, setPrefs] = useState<NotificationPrefs>({ notificationsEnabled: true, marketingConsent: false });
    const { locale } = useApp();
    const { data: session, status } = useSession();
    const prefLabels = NOTIFICATION_PREF_LABELS[locale] || NOTIFICATION_PREF_LABELS.en;
    const isAuthed = status === 'authenticated' && !!session?.user && !(session.user as any).name?.startsWith('guest_');

    useEffect(() => {
        if (status === 'loading') return;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            let nextPrefs = readLocalPrefs();

            if (isAuthed) {
                try {
                    const prefRes = await fetch('/api/me/preferences');
                    if (prefRes.ok) {
                        const data = await prefRes.json();
                        const serverPrefs = data.preferences || {};
                        nextPrefs = {
                            notificationsEnabled: serverPrefs.notificationsEnabled !== false,
                            marketingConsent: Boolean(data.marketingConsent),
                        };
                        writeLocalPrefs(nextPrefs);
                    }
                } catch {
                    // Keep local fallback.
                }
            }

            if (cancelled) return;
            setPrefs(nextPrefs);

            if (!nextPrefs.notificationsEnabled) {
                setNotifications([]);
                setLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/notifications');
                const data = await res.json();
                const list = Array.isArray(data) ? data : [];
                setNotifications(nextPrefs.marketingConsent ? list : list.filter((n: any) => n.type !== 'marketing'));
            } catch {
                setNotifications([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [isAuthed, status]);

    const updatePrefs = async (patch: Partial<NotificationPrefs>) => {
        const next = { ...prefs, ...patch };
        setPrefs(next);
        writeLocalPrefs(next);
        if (!next.notificationsEnabled) {
            setNotifications([]);
        }
        if (isAuthed) {
            fetch('/api/me/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notificationsEnabled: next.notificationsEnabled,
                    marketingConsent: next.marketingConsent,
                }),
            }).catch(() => { });
        }
        if (next.notificationsEnabled) {
            fetch('/api/notifications')
                .then(r => r.json())
                .then(data => {
                    const list = Array.isArray(data) ? data : [];
                    setNotifications(next.marketingConsent ? list : list.filter((n: any) => n.type !== 'marketing'));
                })
                .catch(() => { });
        }
    };

    // Collect all translatable texts (use English version if available, otherwise Korean)
    const textsToTranslate = notifications.flatMap(n => [
        n.titleEn || n.title || '',
        n.messageEn || n.message || ''
    ]);
    const translations = useTranslatedTexts(textsToTranslate, locale as Locale);

    const getTitle = (n: any) => {
        if (locale === 'ko') return n.title;
        const src = n.titleEn || n.title || '';
        return translations.get(src) || src;
    };
    const getMessage = (n: any) => {
        if (locale === 'ko') return n.message;
        const src = n.messageEn || n.message || '';
        return translations.get(src) || src;
    };

    const markAllRead = () => {
        fetch('/api/notifications/read-all', { method: 'POST' })
            .then(() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))));
    };

    const markRead = (id: string) => {
        fetch(`/api/notifications/${id}/read`, { method: 'POST' });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (loading) return (
        <div className="mm-notifications-page2 mm-library-page2 no-back-swipe mx-auto w-full max-w-[760px] px-5 pb-32 pt-[max(28px,env(safe-area-inset-top,0px))] lg:pb-12">
            <section className="mm-notification-hero2 mb-8 p-6 sm:p-8">
                <div className="mm-skel-pill mb-5 w-28" />
                <div className="mm-skel-line mb-3 w-48" />
                <div className="mm-skel-line w-36 opacity-70" />
            </section>
            <div className="mm-notification-list2">
                {[0, 1, 2].map(i => (
                    <div key={i} className="mm-notification-row2">
                        <div className="mm-skel-circle h-12 w-12 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="mm-skel-line mb-3 w-2/3" />
                            <div className="mm-skel-line w-full opacity-70" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <>
            <div className="mm-notifications-page2 mm-library-page2 no-back-swipe mx-auto w-full max-w-[760px] px-5 pb-32 pt-[max(28px,env(safe-area-inset-top,0px))] lg:pb-12 animate-slideInDown">
                <section className="mm-notification-hero2 mb-8 p-6 sm:p-8">
                    <div className="mm-gallery-kicker mb-5">
                        {t('notif.label', locale)}
                    </div>
                    <div className="flex items-end justify-between gap-4">
                        <div className="min-w-0">
                            <h1>
                                {t('notif.title', locale)}
                            </h1>
                            <p>
                                {unreadCount > 0
                                    ? `${unreadCount} ${t('notif.unreadCount', locale)}`
                                    : t('notif.allCaughtUp', locale)}
                            </p>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="mm-notification-mark-button"
                            >
                                {t('notif.markAllRead', locale)}
                            </button>
                        )}
                    </div>
                </section>

                <section className="mm-notification-pref-card2 mb-7" aria-label={prefLabels.controlsTitle}>
                    <div className="mm-notification-pref-head2">
                        <div>
                            <h2>{prefLabels.controlsTitle}</h2>
                            <p>{prefLabels.controlsDesc}</p>
                        </div>
                    </div>
                    <button type="button" className="mm-notification-pref-row2" onClick={() => updatePrefs({ notificationsEnabled: !prefs.notificationsEnabled })}>
                        <span>
                            <strong>{prefLabels.notifications}</strong>
                            <em>{prefLabels.notificationsDesc}</em>
                        </span>
                        <span className={`mm-settings-toggle ${prefs.notificationsEnabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                    </button>
                    <button type="button" className="mm-notification-pref-row2" onClick={() => updatePrefs({ marketingConsent: !prefs.marketingConsent })}>
                        <span>
                            <strong>{prefLabels.marketing}</strong>
                            <em>{prefLabels.marketingDesc}</em>
                        </span>
                        <span className={`mm-settings-toggle ${prefs.marketingConsent ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                    </button>
                </section>

                {!prefs.notificationsEnabled ? (
                    <EmptyStateGame locale={locale} title={prefLabels.disabledTitle} description={prefLabels.disabledDesc} compact />
                ) : notifications.length === 0 ? (
                    <EmptyStateGame locale={locale} title={t('notif.empty', locale)} description={t('notif.emptyDesc', locale)} compact />
                ) : (
                    <div className="mm-notification-list2">
                        {notifications.map(n => (
                            <Link
                                key={n.id}
                                href={`/notifications/${n.id}`}
                                data-mm-route-pending="off"
                                onClick={() => { if (!n.isRead) markRead(n.id); }}
                                className={`mm-notification-row2 ${!n.isRead ? 'is-unread' : ''}`}
                            >
                                <div className="mm-notification-icon2">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.85 18.25a2.85 2.85 0 01-5.7 0M18 10.5a6 6 0 10-12 0c0 3-1.5 4.5-2 5.5h16c-.5-1-2-2.5-2-5.5z" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        {!n.isRead && <span className="mm-notification-unread-dot" />}
                                        <h3 style={{ wordBreak: 'break-word' }}>
                                            {getTitle(n)}
                                        </h3>
                                    </div>
                                    <p className="line-clamp-2" style={{ wordBreak: 'break-word' }}>
                                        {getMessage(n)}
                                    </p>
                                    <time>
                                        {formatDate(n.createdAt, locale)}
                                    </time>
                                </div>
                                <svg className="h-4 w-4 shrink-0 text-slate-300 dark:text-blue-200/34" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
