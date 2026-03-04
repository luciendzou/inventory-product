<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
const page = ref({ title: 'Notifications' });
const breadcrumbs = ref([
    { title: 'Extra', disabled: false, href: '#' },
    { title: 'Notifications', disabled: true, href: '#' }
]);

const loading = ref(false);
const search = ref('');
const notifications = ref<any[]>([]);
const unreadOnly = ref(false);
const selectedType = ref('');
const perPage = ref(20);
const currentPage = ref(1);
const totalItems = ref(0);
const unreadCountApi = ref(0);

const normalizeNotification = (item: any) => {
    return {
        id: item.id_notification || item.id || crypto.randomUUID(),
        type: item.type || '',
        title: item.title || item.titre || item.type || 'Notification',
        message: item.message || item.contenu || item.description || '-',
        created_at: item.created_at || item.date || item.timestamp || new Date().toISOString(),
        is_read: Boolean(item.is_read ?? item.read ?? item.lu ?? false)
    };
};

const onUnreadCountEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ count: number }>;
    unreadCountApi.value = Number(customEvent.detail?.count) || 0;
};

const onNewNotificationEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ notification: any }>;
    const incoming = customEvent.detail?.notification;
    if (!incoming?.id) return;
    const exists = notifications.value.some((n: any) => n.id === incoming.id);
    if (exists) return;
    notifications.value.unshift(normalizeNotification(incoming));
    totalItems.value = Number(totalItems.value || 0) + 1;
};

const fetchUnreadCount = async () => {
    try {
        const res = await axiosInstance.get('/notifications/unread-count');
        unreadCountApi.value = Number(res.data?.count) || 0;
    } catch (error) {
        // fallback silencieux: on garde le calcul local
        unreadCountApi.value = notifications.value.filter((n: any) => !n.is_read).length;
    }
};

const fetchNotifications = async () => {
    loading.value = true;
    try {
        const params: Record<string, any> = {
            per_page: perPage.value,
            page: currentPage.value
        };
        if (unreadOnly.value) params.unread = true;
        if (selectedType.value) params.type = selectedType.value;

        const res = await axiosInstance.get('/notifications', { params });
        const payload = res.data;
        const data = Array.isArray(payload?.data) ? payload.data : [];
        notifications.value = data.map(normalizeNotification);
        totalItems.value = Number(payload?.total) || notifications.value.length;
        await fetchUnreadCount();
    } catch (error) {
        console.error(error);
        toast.error('Impossible de charger les notifications.');
    } finally {
        loading.value = false;
    }
};

const filteredNotifications = computed(() => {
    if (!search.value) return notifications.value;
    const s = search.value.toLowerCase();
    return notifications.value.filter((n: any) => {
        return String(n.title).toLowerCase().includes(s) || String(n.message).toLowerCase().includes(s);
    });
});

const unreadCount = computed(() => {
    if (Number.isFinite(unreadCountApi.value) && unreadCountApi.value >= 0) {
        return unreadCountApi.value;
    }
    return notifications.value.filter((n: any) => !n.is_read).length;
});

const totalPages = computed(() => {
    const size = Number(perPage.value) || 20;
    return Math.max(1, Math.ceil((Number(totalItems.value) || 0) / size));
});

const typeOptions = computed(() => {
    const set = new Set<string>();
    notifications.value.forEach((n: any) => {
        if (n.type) set.add(n.type);
    });
    return Array.from(set);
});

const escapeHtml = (value: string) => {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const printPage = () => {
    const rows = filteredNotifications.value;
    if (!rows.length) {
        toast.warning('Aucune notification à imprimer.');
        return;
    }

    const rowsHtml = rows
        .map((item: any, index: number) => {
            const status = item.is_read ? 'Lue' : 'Non lue';
            return `
                <tr>
                    <td style="border:1px solid #d1d5db; padding:8px;">${index + 1}</td>
                    <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(item.title || '-')}</td>
                    <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(item.message || '-')}</td>
                    <td style="border:1px solid #d1d5db; padding:8px; text-align:center;">${escapeHtml(status)}</td>
                    <td style="border:1px solid #d1d5db; padding:8px;">${new Date(item.created_at).toLocaleString()}</td>
                </tr>
            `;
        })
        .join('');

    const content = `
        <div style="font-family: Arial, sans-serif; color:#111827; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
                <div>
                    <div style="font-weight:700; font-size:18px;">Centre de notifications</div>
                    <div style="margin-top: 8px; font-size: 13px;"><strong>Non lues:</strong> ${unreadCount.value}</div>
                </div>
                <div style="text-align:right; font-size:12px;">
                    <div>Imprimé le: ${new Date().toLocaleString()}</div>
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f3f4f6;">
                        <th style="border:1px solid #d1d5db; padding:8px; width:50px;">#</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Titre</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Message</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:center; width:100px;">Statut</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left; width:180px;">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;

    const printWindow = window.open('', '', 'height=900,width=1200');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Notifications</title></head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
};

const markAllAsRead = async () => {
    try {
        const res = await axiosInstance.patch('/notifications/read-all');
        notifications.value = notifications.value.map((n: any) => ({ ...n, is_read: true }));
        unreadCountApi.value = 0;
        const updated = Number(res.data?.updated) || 0;
        toast.success(updated > 0 ? `${updated} notification(s) marquée(s) lue(s).` : 'Toutes les notifications sont déjà lues.');
        if (unreadOnly.value) {
            await fetchNotifications();
        }
    } catch (error) {
        console.error(error);
        toast.error('Impossible de marquer toutes les notifications comme lues.');
    }
};

const markAsRead = async (item: any) => {
    if (!item?.id || item.is_read) return;
    try {
        await axiosInstance.patch(`/notifications/${item.id}/read`);
        item.is_read = true;
        unreadCountApi.value = Math.max(0, unreadCountApi.value - 1);
    } catch (error) {
        console.error(error);
        toast.error('Impossible de marquer la notification comme lue.');
    }
};

const deleteNotification = async (item: any) => {
    if (!item?.id) return;
    try {
        await axiosInstance.delete(`/notifications/${item.id}`);
        if (!item.is_read) {
            unreadCountApi.value = Math.max(0, unreadCountApi.value - 1);
        }
        notifications.value = notifications.value.filter((n: any) => n.id !== item.id);
        totalItems.value = Math.max(0, (Number(totalItems.value) || 0) - 1);
        toast.success('Notification supprimée.');
    } catch (error) {
        console.error(error);
        toast.error('Impossible de supprimer la notification.');
    }
};

watch([unreadOnly, selectedType, perPage], () => {
    currentPage.value = 1;
    fetchNotifications();
});

watch(currentPage, () => {
    fetchNotifications();
});

onMounted(() => {
    window.addEventListener('notifications:unread-count', onUnreadCountEvent as EventListener);
    window.addEventListener('notifications:new', onNewNotificationEvent as EventListener);
    fetchNotifications();
});

onUnmounted(() => {
    window.removeEventListener('notifications:unread-count', onUnreadCountEvent as EventListener);
    window.removeEventListener('notifications:new', onNewNotificationEvent as EventListener);
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>

    <v-row>
        <v-col cols="12">
            <UiParentCard title="Centre de notifications" style="padding: 2rem;">
                <template v-slot:action>
                    <div class="d-flex ga-2 align-center">
                        <v-chip color="warning" label>{{ unreadCount }} non lues</v-chip>
                        <v-btn
                            color="primary"
                            variant="text"
                            prepend-icon="mdi-check-all"
                            :disabled="unreadCount === 0"
                            @click="markAllAsRead"
                        >
                            Tout marquer lues
                        </v-btn>
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                        <v-btn color="primary" variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="fetchNotifications">Rafraîchir</v-btn>
                    </div>
                </template>

                <v-text-field
                    v-model="search"
                    prepend-inner-icon="mdi-magnify"
                    label="Rechercher une notification..."
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-4"
                />

                <v-row class="mb-3" dense>
                    <v-col cols="12" md="3">
                        <v-switch v-model="unreadOnly" label="Non lues uniquement" color="primary" hide-details />
                    </v-col>
                    <v-col cols="12" md="5">
                        <v-select
                            v-model="selectedType"
                            :items="typeOptions"
                            label="Type"
                            variant="outlined"
                            density="compact"
                            clearable
                            hide-details
                        />
                    </v-col>
                    <v-col cols="12" md="2">
                        <v-select
                            v-model="perPage"
                            :items="[10, 20, 50, 100]"
                            label="Par page"
                            variant="outlined"
                            density="compact"
                            hide-details
                        />
                    </v-col>
                </v-row>

                <v-list lines="two" class="rounded border">
                    <v-list-item v-for="item in filteredNotifications" :key="item.id" @click="markAsRead(item)" style="cursor: pointer;">
                        <template v-slot:prepend>
                            <v-avatar :color="item.is_read ? 'grey-lighten-2' : 'warning'" variant="tonal" size="36">
                                <v-icon>mdi-bell-outline</v-icon>
                            </v-avatar>
                        </template>
                        <v-list-item-title class="font-weight-medium">{{ item.title }}</v-list-item-title>
                        <v-list-item-subtitle>{{ item.message }}</v-list-item-subtitle>
                        <template v-slot:append>
                            <div class="d-flex align-center ga-2">
                                <v-btn
                                    v-if="!item.is_read"
                                    size="x-small"
                                    variant="text"
                                    color="primary"
                                    @click.stop="markAsRead(item)"
                                >
                                    Marquer lue
                                </v-btn>
                                <v-btn
                                    size="x-small"
                                    variant="text"
                                    color="error"
                                    @click.stop="deleteNotification(item)"
                                >
                                    Supprimer
                                </v-btn>
                                <div class="text-caption text-medium-emphasis">
                                    {{ new Date(item.created_at).toLocaleString() }}
                                </div>
                            </div>
                        </template>
                    </v-list-item>
                    <v-list-item v-if="filteredNotifications.length === 0 && !loading">
                        <v-list-item-title class="text-medium-emphasis">Aucune notification.</v-list-item-title>
                    </v-list-item>
                </v-list>

                <div class="d-flex justify-center mt-4" v-if="totalPages > 1">
                    <v-pagination v-model="currentPage" :length="totalPages" rounded="circle" />
                </div>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
