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
    const configuredHost = (import.meta.env.VITE_PUSHER_HOST || '').trim();
    const port = Number(import.meta.env.VITE_PUSHER_PORT || 443);
    const scheme = (import.meta.env.VITE_PUSHER_SCHEME || 'https').toLowerCase();
    const cluster = (import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1').trim();

    const options: any = {
        broadcaster: 'pusher',
        key: appKey,
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${getApiBaseUrl()}/broadcasting/auth`,
        auth: {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        }
    };

    // Pusher Cloud: cluster obligatoire, pas de wsHost custom.
    // Soketi / host custom: wsHost/wsPort, cluster facultatif.
    if (configuredHost) {
        options.wsHost = configuredHost;
        options.wsPort = port;
        options.wssPort = port;
        if (cluster) options.cluster = cluster;
    } else if (cluster) {
        options.cluster = cluster;
    }

    echoInstance = new Echo(options);

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
