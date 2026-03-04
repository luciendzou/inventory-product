import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

let echoInstance: Echo<'pusher'> | null = null;
let echoToken = '';

const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_BASE_URL || 'https://api.inventory.cremin-cam.org/api';
};

export const initEcho = (token: string) => {
    if (echoInstance && echoToken === token) {
        return echoInstance;
    }

    if (echoInstance) {
        echoInstance.disconnect();
        echoInstance = null;
    }

    (window as any).Pusher = Pusher;

    const appKey = import.meta.env.VITE_PUSHER_APP_KEY;
    const configuredHost = import.meta.env.VITE_PUSHER_HOST;
    const host = configuredHost || new URL(getApiBaseUrl()).hostname;
    const port = Number(import.meta.env.VITE_PUSHER_PORT || 443);
    const scheme = (import.meta.env.VITE_PUSHER_SCHEME || 'https').toLowerCase();
    const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1';

    echoInstance = new Echo({
        broadcaster: 'pusher',
        key: appKey,
        cluster,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${getApiBaseUrl()}/broadcasting/auth`,
        auth: {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        }
    });

    echoToken = token;
    return echoInstance;
};

export const getEcho = () => echoInstance;

export const disconnectEcho = () => {
    if (!echoInstance) return;
    echoInstance.disconnect();
    echoInstance = null;
    echoToken = '';
};
