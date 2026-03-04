<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SalesOverview from '@/components/dashboard/SalesOverview.vue';
import YearlyBreakup from '@/components/dashboard/YearlyBreakup.vue';
import MonthlyEarning from '@/components/dashboard/MonthlyEarnings.vue';
import RecentTransaction from '@/components/dashboard/RecentTransaction.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const loading = ref(true);
const roleName = ref('');
const currentUser = ref<any>(null);
const users = ref<any[]>([]);
const demandes = ref<any[]>([]);
const sorties = ref<any[]>([]);
const rolloverLoading = ref(false);
const rolloverDone = ref(false);

const normalizedRole = computed(() => roleName.value.toLowerCase());
const isAgent = computed(() => normalizedRole.value.includes('agent'));
const shouldShowGlobalDashboard = computed(() => {
    if (isAgent.value) return false;
    return ['direction', 'contrôle', 'controle', 'admin', 'agence'].some((r) => normalizedRole.value.includes(r));
});

const rolloverTargetYear = computed(() => new Date().getFullYear());
const isRolloverWindowOpen = computed(() => {
    const now = new Date();
    return now.getMonth() === 0 && now.getDate() <= 30;
});
const rolloverStorageKey = computed(() => {
    const scope = currentUser.value?.id_entreprise || 'default';
    return `stock-year-rollover:${scope}:${rolloverTargetYear.value}`;
});
const canShowRolloverButton = computed(() => {
    return shouldShowGlobalDashboard.value && isRolloverWindowOpen.value && !rolloverDone.value;
});

const normalizeStatus = (value: string) => {
    return (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
};

const isReceivedStatus = (status: string) => {
    const s = normalizeStatus(status);
    return s.includes('CONFIRM') || s.includes('VALID') || s.includes('RECU') || s.includes('LIVRE');
};

const isRefusedStatus = (status: string) => {
    return normalizeStatus(status).includes('REFUS');
};

const agentStats = computed(() => {
    const rows = sorties.value.map((s: any) => s.statut_direction || s.statut || 'EN_ATTENTE');
    const received = rows.filter((s: string) => isReceivedStatus(s)).length;
    const refused = rows.filter((s: string) => isRefusedStatus(s)).length;
    const pending = rows.length - received - refused;

    const totalQtyReceived = sorties.value
        .filter((s: any) => isReceivedStatus(s.statut_direction || s.statut || ''))
        .reduce((sum: number, s: any) => sum + Number(s.quantite_sortie || 0), 0);

    return {
        demandes: demandes.value.length,
        sorties: sorties.value.length,
        received,
        refused,
        pending,
        totalQtyReceived
    };
});

const recentAgentRows = computed(() => {
    return [...sorties.value]
        .sort((a: any, b: any) => {
            const da = new Date(a.date_sortie || a.created_at || 0).getTime();
            const db = new Date(b.date_sortie || b.created_at || 0).getTime();
            return db - da;
        })
        .slice(0, 8);
});

const getProductName = (item: any) => {
    return item?.product?.nom || t('common.product');
};

const statusChartSeries = computed(() => {
    return [agentStats.value.received, agentStats.value.refused, agentStats.value.pending];
});

const statusChartOptions = computed(() => ({
    labels: [t('dashboard.receivedProducts'), t('dashboard.refusedProducts'), t('dashboard.pending')],
    colors: ['#4CAF50', '#F44336', '#FF9800'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: true }
}));

const twoDigits = (value: number) => {
    return value < 10 ? `0${value}` : `${value}`;
};

const monthlyChartData = computed(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${twoDigits(d.getMonth() + 1)}`;
        const label = d.toLocaleDateString('fr-FR', { month: 'short' });
        months.push({ key, label });
    }

    const demandesCount = months.map((m) =>
        demandes.value.filter((d: any) => {
            if (!d?.date_demande) return false;
            const date = new Date(d.date_demande);
            const key = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}`;
            return key === m.key;
        }).length
    );

    const recuesCount = months.map((m) =>
        sorties.value.filter((s: any) => {
            const rawDate = s.date_sortie || s.created_at;
            if (!rawDate) return false;
            const date = new Date(rawDate);
            const key = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}`;
            return key === m.key && isReceivedStatus(s.statut_direction || s.statut || '');
        }).length
    );

    return {
        categories: months.map((m) => m.label),
        series: [
            { name: t('dashboard.myRequests'), data: demandesCount },
            { name: t('dashboard.receivedProducts'), data: recuesCount }
        ]
    };
});

const monthlyChartOptions = computed(() => ({
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
    xaxis: { categories: monthlyChartData.value.categories },
    colors: ['#1E88E5', '#43A047'],
    legend: { position: 'top' }
}));

const topProductsData = computed(() => {
    const map = new Map<string, number>();
    sorties.value.forEach((s: any) => {
        const name = getProductName(s);
        const qty = Number(s.quantite_sortie || 0);
        map.set(name, (map.get(name) || 0) + qty);
    });

    const rows = Array.from(map.entries())
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 6);

    return {
        categories: rows.map((r) => r.name),
        values: rows.map((r) => r.qty)
    };
});

const topProductsOptions = computed(() => ({
    chart: { type: 'bar', toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, borderRadius: 6 } },
    xaxis: { categories: topProductsData.value.categories },
    colors: ['#5E35B1'],
    dataLabels: { enabled: true }
}));

const fetchRole = async () => {
    const { data: user } = await axiosInstance.get('/user');
    currentUser.value = user;
    const profileId = user.id_profil || user.profil_id || user.profil?.id_profil;

    if (user.profil?.nom) {
        roleName.value = user.profil.nom;
        return;
    }

    if (profileId) {
        const { data: profils } = await axiosInstance.get('/profils');
        const profil = (Array.isArray(profils) ? profils : []).find((p: any) => p.id_profil === profileId);
        roleName.value = profil?.nom || '';
    }
};

const getScopedDemandes = async () => {
    if (!currentUser.value) return [];

    if (isAgent.value) {
        const { data } = await axiosInstance.get('/demandes/me');
        return Array.isArray(data) ? data : [];
    }

    const [demandesRes, usersRes] = await Promise.all([
        axiosInstance.get('/demandes'),
        axiosInstance.get('/users')
    ]);

    users.value = Array.isArray(usersRes.data) ? usersRes.data : [];
    const allDemandes = Array.isArray(demandesRes.data) ? demandesRes.data : [];

    const userAgence = currentUser.value?.agence;
    const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

    if (!userAgence && !userPoleId) return allDemandes;

    return allDemandes.filter((req: any) => {
        const requester = users.value.find((u: any) => u.id_users === req.id_users);
        if (!requester) return false;
        const requesterPoleId = requester.id_pole || requester.pole_id || requester.pole?.id_pole;
        const matchAgence = userAgence && requester.agence === userAgence;
        const matchPole = userPoleId && requesterPoleId === userPoleId;
        return matchAgence || matchPole;
    });
};

const fetchAgentData = async () => {
    demandes.value = await getScopedDemandes();

    const sortiesParDemande = await Promise.all(
        demandes.value.map(async (d: any) => {
            try {
                const res = await axiosInstance.get(`/demandes/${d.id_demande}/sorties`);
                const rows = Array.isArray(res.data) ? res.data : [];
                return rows.map((s: any) => ({
                    ...s,
                    demande_id: d.id_demande,
                    demande_motif: d.motif || ''
                }));
            } catch {
                return [];
            }
        })
    );

    sorties.value = sortiesParDemande.reduce((acc: any[], items: any[]) => acc.concat(items), []);
};

const hydrateRolloverState = () => {
    try {
        rolloverDone.value = localStorage.getItem(rolloverStorageKey.value) === '1';
    } catch {
        rolloverDone.value = false;
    }
};

const saveRolloverState = () => {
    try {
        localStorage.setItem(rolloverStorageKey.value, '1');
    } catch {
        // no-op
    }
};

const runYearRollover = async () => {
    if (!canShowRolloverButton.value || rolloverLoading.value) return;

    rolloverLoading.value = true;
    try {
        const payload = { year: rolloverTargetYear.value };
        const { data } = await axiosInstance.post('/stock/year-rollover', payload);
        rolloverDone.value = true;
        saveRolloverState();
        toast.success(data?.message || t('toasts.rolloverDone'));
    } catch (error: any) {
        const status = error?.response?.status;
        if (status === 409) {
            rolloverDone.value = true;
            saveRolloverState();
            toast.info(error?.response?.data?.message || t('toasts.rolloverAlreadyDone'));
        } else {
            toast.error(error?.response?.data?.message || t('toasts.rolloverError'));
        }
    } finally {
        rolloverLoading.value = false;
    }
};

const initDashboard = async () => {
    loading.value = true;
    try {
        await fetchRole();
        hydrateRolloverState();
        if (!shouldShowGlobalDashboard.value) {
            await fetchAgentData();
        }
    } catch (error) {
        console.error('Erreur chargement dashboard', error);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    initDashboard();
});
</script>

<template>
    <v-row>
        <v-col cols="12">
            <v-row v-if="shouldShowGlobalDashboard">
                <v-col cols="12" v-if="canShowRolloverButton">
                    <v-alert type="warning" variant="tonal" class="d-flex align-center justify-space-between">
                        <div>
                            <div class="font-weight-bold">{{ $t('dashboard.rolloverTitle') }}</div>
                            <div class="text-body-2">{{ $t('dashboard.rolloverHint', { year: rolloverTargetYear }) }}</div>
                        </div>
                        <v-btn color="warning" variant="elevated" :loading="rolloverLoading" @click="runYearRollover">
                            {{ $t('dashboard.rolloverAction') }}
                        </v-btn>
                    </v-alert>
                </v-col>
                <v-col cols="12" lg="8">
                    <SalesOverview />
                </v-col>
                <v-col cols="12" lg="4">
                    <div class="mb-6">
                        <YearlyBreakup />
                    </div>
                    <div>
                        <MonthlyEarning />
                    </div>
                </v-col>
                <v-col cols="12" lg="12">
                    <RecentTransaction />
                </v-col>
            </v-row>

            <v-row v-else>
                <v-col cols="12" md="3">
                    <v-card variant="outlined" class="pa-4">
                        <div class="text-caption text-medium-emphasis">{{ isAgent ? $t('dashboard.myRequests') : $t('dashboard.scopeRequests') }}</div>
                        <div class="text-h4 font-weight-bold">{{ agentStats.demandes }}</div>
                    </v-card>
                </v-col>
                <v-col cols="12" md="3">
                    <v-card variant="outlined" class="pa-4">
                        <div class="text-caption text-medium-emphasis">{{ $t('dashboard.receivedProducts') }}</div>
                        <div class="text-h4 font-weight-bold text-success">{{ agentStats.received }}</div>
                    </v-card>
                </v-col>
                <v-col cols="12" md="3">
                    <v-card variant="outlined" class="pa-4">
                        <div class="text-caption text-medium-emphasis">{{ $t('dashboard.refusedProducts') }}</div>
                        <div class="text-h4 font-weight-bold text-error">{{ agentStats.refused }}</div>
                    </v-card>
                </v-col>
                <v-col cols="12" md="3">
                    <v-card variant="outlined" class="pa-4">
                        <div class="text-caption text-medium-emphasis">{{ $t('dashboard.receivedQty') }}</div>
                        <div class="text-h4 font-weight-bold text-primary">{{ agentStats.totalQtyReceived }}</div>
                    </v-card>
                </v-col>

                <v-col cols="12" md="4">
                    <v-card elevation="10">
                        <v-card-item>
                            <v-card-title class="text-h6">{{ $t('dashboard.exitStatus') }}</v-card-title>
                            <apexchart v-if="!loading" type="donut" height="260" :options="statusChartOptions" :series="statusChartSeries" />
                        </v-card-item>
                    </v-card>
                </v-col>

                <v-col cols="12" md="8">
                    <v-card elevation="10">
                        <v-card-item>
                            <v-card-title class="text-h6">{{ $t('dashboard.monthlyEvolution') }}</v-card-title>
                            <apexchart v-if="!loading" type="bar" height="260" :options="monthlyChartOptions" :series="monthlyChartData.series" />
                        </v-card-item>
                    </v-card>
                </v-col>

                <v-col cols="12">
                    <v-card elevation="10">
                        <v-card-item>
                            <v-card-title class="text-h6">{{ $t('dashboard.topProducts') }}</v-card-title>
                            <apexchart
                                v-if="!loading"
                                type="bar"
                                height="260"
                                :options="topProductsOptions"
                                :series="[{ name: 'Quantite', data: topProductsData.values }]"
                            />
                        </v-card-item>
                    </v-card>
                </v-col>

                <v-col cols="12">
                    <v-card elevation="10">
                        <v-card-item>
                            <div class="d-flex justify-space-between align-center mb-4">
                                <v-card-title class="text-h5">{{ isAgent ? $t('dashboard.myLatestMoves') : $t('dashboard.scopeLatestMoves') }}</v-card-title>
                                <v-btn color="primary" variant="outlined" @click="router.push(isAgent ? '/users/agent-report' : '/products/global-history')">
                                    {{ $t('common.details') }}
                                </v-btn>
                            </div>

                            <v-table :loading="loading">
                                <thead>
                                    <tr>
                                        <th class="text-left">{{ $t('common.date') }}</th>
                                        <th class="text-left">{{ $t('common.product') }}</th>
                                        <th class="text-left">{{ $t('common.quantity') }}</th>
                                        <th class="text-left">{{ $t('common.status') }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="item in recentAgentRows" :key="item.id_sortie_stock">
                                        <td>{{ item.date_sortie ? new Date(item.date_sortie).toLocaleDateString() : '-' }}</td>
                                        <td>{{ getProductName(item) }}</td>
                                        <td>{{ item.quantite_sortie || 0 }}</td>
                                        <td>
                                            <v-chip
                                                size="small"
                                                :color="isRefusedStatus(item.statut_direction || item.statut || '') ? 'error' : (isReceivedStatus(item.statut_direction || item.statut || '') ? 'success' : 'warning')"
                                            >
                                                {{ item.statut_direction || item.statut || 'EN_ATTENTE' }}
                                            </v-chip>
                                        </td>
                                    </tr>
                                    <tr v-if="recentAgentRows.length === 0 && !loading">
                                        <td colspan="4" class="text-center text-medium-emphasis py-4">{{ $t('dashboard.noMove') }}</td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </v-card-item>
                    </v-card>
                </v-col>
            </v-row>
        </v-col>
    </v-row>
</template>
