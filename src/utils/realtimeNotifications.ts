import axiosInstance from '@/utils/axios';
import { createToastInterface } from 'vue-toastification';
import { disconnectEcho, getEcho, initEcho } from '@/utils/echo';

const toast = createToastInterface();
const POLL_INTERVAL_MS = 25000;
const STORAGE_UNREAD_KEY = 'notificationsUnreadCount';

let currentUserId: string | null = null;
let currentChannel: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const normalizeNotification = (item: any) => ({
    id: item?.id_notification || item?.id || crypto.randomUUID(),
    type: item?.type || '',
    title: item?.title || item?.titre || item?.type || 'Notification',
    message: item?.message || item?.contenu || item?.description || '-',
    created_at: item?.created_at || item?.date || item?.timestamp || new Date().toISOString(),
    is_read: Boolean(item?.is_read ?? item?.read ?? item?.lu ?? false)
});

const dispatchUnreadCount = (count: number) => {
    localStorage.setItem(STORAGE_UNREAD_KEY, String(count));
    window.dispatchEvent(new CustomEvent('notifications:unread-count', { detail: { count } }));
};

const dispatchNewNotification = (notification: any) => {
    window.dispatchEvent(new CustomEvent('notifications:new', { detail: { notification } }));
};

const fetchUnreadCount = async () => {
    try {
        const res = await axiosInstance.get('/notifications/unread-count');
        const count = Number(res.data?.count) || 0;
        dispatchUnreadCount(count);
    } catch {
        // ignore polling failures
    }
};

const startUnreadPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    fetchUnreadCount();
    pollTimer = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
};

const stopUnreadPolling = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
};

export const startRealtimeNotifications = (userId?: string, token?: string) => {
    const authToken = token || localStorage.getItem('authToken');
    const targetUserId = userId || localStorage.getItem('authUserId');
    if (!authToken || !targetUserId) return;

    const echo = initEcho(authToken);
    const channel = `user.${targetUserId}`;

    if (currentChannel && currentChannel !== channel) {
        echo.leave(currentChannel);
    }

    // avoid duplicate listeners on re-init
    echo.leave(channel);
    echo.private(channel).listen('.notification.created', (payload: any) => {
        const notification = normalizeNotification(payload?.notification || payload);
        const previous = Number(localStorage.getItem(STORAGE_UNREAD_KEY) || '0');
        dispatchUnreadCount(previous + (notification.is_read ? 0 : 1));
        dispatchNewNotification(notification);
        toast.info(notification.title ? `${notification.title}: ${notification.message}` : notification.message);
    });

    currentUserId = targetUserId;
    currentChannel = channel;
    startUnreadPolling();
};

export const stopRealtimeNotifications = () => {
    const echo = getEcho();
    if (echo && currentChannel) {
        echo.leave(currentChannel);
    }

    stopUnreadPolling();
    disconnectEcho();
    currentUserId = null;
    currentChannel = null;
};

export const bootstrapRealtimeFromSession = () => {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('authUserId');
    if (!token || !userId) return;
    startRealtimeNotifications(userId, token);
};

