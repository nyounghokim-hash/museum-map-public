'use client';

import { invalidateAccountSaves } from '@/hooks/useAccountSaves';
import { invalidateCompareCache } from '@/hooks/useCompare';

export function clearClientAccountStateForLogout() {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.removeItem('user-email');
        sessionStorage.removeItem('isGuest');
    } catch { }
    try {
        localStorage.removeItem('compareMuseums');
        localStorage.removeItem('activeTrip');
    } catch { }
    invalidateCompareCache();
    invalidateAccountSaves();
    window.dispatchEvent(new CustomEvent('activeTripChange', { detail: null }));
}
