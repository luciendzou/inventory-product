<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

interface User {
    id_users: string;
    name?: string | null;
    email?: string | null;
    profil_id?: string | null;
    profil?: { id_profil: string; nom: string } | null;
    agence?: string | null;
}

interface Profil {
    id_profil: string;
    nom: string;
}

interface Demande {
    id_demande: string;
    id_users: string;
    date_demande: string;
    statut?: string;
}

const toast = useToast();
const page = ref({ title: 'Rapport Utilisateurs' });
const breadcrumbs = ref([
    { title: 'Utilisateurs', disabled: false, href: '#' },
    { title: 'Rapport', disabled: true, href: '#' }
]);

const loading = ref(false);
const users = ref<User[]>([]);
const profils = ref<Profil[]>([]);
const demandes = ref<Demande[]>([]);
const currentUser = ref<User | null>(null);

const normalizeArray = (payload: any) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

const fetchData = async () => {
    loading.value = true;
    try {
        const [usersRes, profilsRes, demandesRes, currentUserRes] = await Promise.all([
            axiosInstance.get('/users'),
            axiosInstance.get('/profils'),
            axiosInstance.get('/demandes'),
            axiosInstance.get('/user')
        ]);
        const allUsers: User[] = normalizeArray(usersRes.data);
        const allProfils: Profil[] = normalizeArray(profilsRes.data);
        const allDemandes: Demande[] = normalizeArray(demandesRes.data);
        const me: User | null = currentUserRes?.data || null;

        currentUser.value = me;
        profils.value = allProfils;

        const myProfileId = me?.profil_id || me?.profil?.id_profil || (me as any)?.id_profil || null;
        const myProfileName =
            me?.profil?.nom ||
            allProfils.find((p) => p.id_profil === myProfileId)?.nom ||
            '';
        const isDirectionAdmin = myProfileName.toLowerCase().includes('direction');
        const myAgence = me?.agence || null;

        if (isDirectionAdmin || !myAgence) {
            users.value = allUsers;
            demandes.value = allDemandes;
            return;
        }

        const allowedUsers = allUsers.filter((u) => (u.agence || '') === myAgence);
        const allowedIds = new Set(allowedUsers.map((u) => u.id_users));

        users.value = allowedUsers;
        demandes.value = allDemandes.filter((d) => allowedIds.has(d.id_users));
    } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Erreur chargement rapport utilisateurs.');
    } finally {
        loading.value = false;
    }
};

const getUserName = (user?: User | null) => user?.name || user?.email || 'Utilisateur inconnu';
const getRoleName = (user?: User | null) => {
    if (!user) return 'Sans rôle';
    if (user.profil?.nom) return user.profil.nom;
    if (!user.profil_id) return 'Sans rôle';
    const found = profils.value.find((p) => p.id_profil === user.profil_id);
    return found?.nom || 'Sans rôle';
};

const usersById = computed(() => {
    return users.value.reduce((acc: Record<string, User>, u) => {
        acc[u.id_users] = u;
        return acc;
    }, {});
});

const now = computed(() => new Date());
const startOfWeek = computed(() => {
    const d = new Date(now.value);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
});
const startOfMonth = computed(() => {
    const d = new Date(now.value.getFullYear(), now.value.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
});
const startOfYear = computed(() => {
    const d = new Date(now.value.getFullYear(), 0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
});

const aggregateByUser = (periodStart: Date) => {
    const counts: Record<string, number> = {};
    demandes.value.forEach((d) => {
        const date = new Date(d.date_demande);
        if (isNaN(date.getTime())) return;
        if (date < periodStart) return;
        counts[d.id_users] = (counts[d.id_users] || 0) + 1;
    });
    return counts;
};

const findExtremes = (counts: Record<string, number>) => {
    const entries: Array<[string, number]> = [];
    for (const key in counts) {
        entries.push([key, counts[key]]);
    }
    if (!entries.length) return { max: null as any, min: null as any };
    let max = entries[0];
    let min = entries[0];
    entries.forEach((e: [string, number]) => {
        if (e[1] > max[1]) max = e;
        if (e[1] < min[1]) min = e;
    });
    const maxUser = usersById.value[max[0]];
    const minUser = usersById.value[min[0]];
    return {
        max: { id: max[0], user: maxUser, count: max[1] },
        min: { id: min[0], user: minUser, count: min[1] }
    };
};

const weeklyCounts = computed(() => aggregateByUser(startOfWeek.value));
const monthlyCounts = computed(() => aggregateByUser(startOfMonth.value));
const yearlyCounts = computed(() => aggregateByUser(startOfYear.value));

const weeklyExtremes = computed(() => findExtremes(weeklyCounts.value));
const monthlyExtremes = computed(() => findExtremes(monthlyCounts.value));
const yearlyExtremes = computed(() => findExtremes(yearlyCounts.value));

const roleDistribution = computed(() => {
    const map: Record<string, number> = {};
    users.value.forEach((u) => {
        const role = getRoleName(u);
        map[role] = (map[role] || 0) + 1;
    });
    const list: Array<{ role: string; count: number }> = [];
    for (const role in map) {
        list.push({ role, count: map[role] });
    }
    return list.sort((a: { role: string; count: number }, b: { role: string; count: number }) => b.count - a.count);
});

const approvalRate = computed(() => {
    const total = demandes.value.length;
    if (!total) return 0;
    const approved = demandes.value.filter((d) => (d.statut || '').toUpperCase() === 'VALIDEE').length;
    return Math.round((approved / total) * 100);
});

const pendingCount = computed(() => {
    return demandes.value.filter((d) => (d.statut || '').toUpperCase() === 'EN_ATTENTE').length;
});

const inactiveUsersYear = computed(() => {
    const activeIds = new Set(Object.keys(yearlyCounts.value));
    return users.value.filter((u) => !activeIds.has(u.id_users)).length;
});

const topYearUsers = computed(() => {
    const list: Array<{ id: string; user: User | undefined; count: number }> = [];
    for (const id in yearlyCounts.value) {
        list.push({ id, user: usersById.value[id], count: yearlyCounts.value[id] });
    }
    return list
        .sort(
            (a: { id: string; user: User | undefined; count: number }, b: { id: string; user: User | undefined; count: number }) =>
                b.count - a.count
        )
        .slice(0, 5);
});

const printReport = () => {
    const makeExt = (label: string, ext: any) => `
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">${label} - Plus actif</td>
            <td style="padding:8px;border:1px solid #ddd;">${ext?.max ? getUserName(ext.max.user) : '-'}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">${ext?.max?.count || 0}</td>
        </tr>
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">${label} - Moins actif</td>
            <td style="padding:8px;border:1px solid #ddd;">${ext?.min ? getUserName(ext.min.user) : '-'}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">${ext?.min?.count || 0}</td>
        </tr>
    `;

    const rolesHtml = roleDistribution.value
        .map((r) => `<tr><td style="padding:8px;border:1px solid #ddd;">${r.role}</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">${r.count}</td></tr>`)
        .join('');

    const content = `
        <div style="font-family:Arial,sans-serif;padding:30px;max-width:900px;margin:0 auto;">
            <h2 style="margin-bottom:20px;">Rapport Utilisateurs</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <thead><tr><th style="padding:8px;border:1px solid #ddd;">Indicateur</th><th style="padding:8px;border:1px solid #ddd;">Utilisateur</th><th style="padding:8px;border:1px solid #ddd;">Nb demandes</th></tr></thead>
                <tbody>
                    ${makeExt('Hebdomadaire', weeklyExtremes.value)}
                    ${makeExt('Mensuel', monthlyExtremes.value)}
                    ${makeExt('Annuel', yearlyExtremes.value)}
                </tbody>
            </table>

            <h3>Utilisateurs par rôle</h3>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr><th style="padding:8px;border:1px solid #ddd;">Rôle</th><th style="padding:8px;border:1px solid #ddd;">Effectif</th></tr></thead>
                <tbody>${rolesHtml}</tbody>
            </table>
        </div>
    `;

    const printWindow = window.open('', '', 'height=700,width=1000');
    if (!printWindow) {
        toast.error("Impossible d'ouvrir la fenêtre d'impression.");
        return;
    }
    printWindow.document.write(`<html><head><title>Rapport Utilisateurs</title></head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
};

const exportExcel = () => {
    const rows: string[] = [];
    rows.push('Section;Indicateur;Utilisateur;Valeur');

    const pushExt = (period: string, ext: any) => {
        rows.push(`Demandes;${period} - Plus actif;${ext?.max ? getUserName(ext.max.user) : '-'};${ext?.max?.count || 0}`);
        rows.push(`Demandes;${period} - Moins actif;${ext?.min ? getUserName(ext.min.user) : '-'};${ext?.min?.count || 0}`);
    };

    pushExt('Hebdomadaire', weeklyExtremes.value);
    pushExt('Mensuel', monthlyExtremes.value);
    pushExt('Annuel', yearlyExtremes.value);

    roleDistribution.value.forEach((r: { role: string; count: number }) => {
        rows.push(`Rôles;${r.role};;${r.count}`);
    });

    rows.push(`Synthèse;Taux approbation global;;${approvalRate.value}%`);
    rows.push(`Synthèse;Demandes en attente;;${pendingCount.value}`);
    rows.push(`Synthèse;Utilisateurs inactifs (année);;${inactiveUsersYear.value}`);

    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
};

onMounted(() => {
    fetchData();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs" />
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Rapport des Demandes Utilisateurs" style="padding: 2rem;">
                <template #action>
                    <div class="d-flex ga-2">
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-file-excel" @click="exportExcel">Exporter Excel</v-btn>
                        <v-btn color="primary" prepend-icon="mdi-printer" @click="printReport">Imprimer / PDF</v-btn>
                    </div>
                </template>

                <v-alert type="info" variant="tonal" class="mb-4">
                    Périodes calculées à la date du jour: hebdomadaire (depuis lundi), mensuelle (depuis le 1er du mois), annuelle (depuis le 1er janvier).
                </v-alert>

                <v-table :loading="loading" class="mb-6">
                    <thead>
                        <tr>
                            <th class="text-left">Période</th>
                            <th class="text-left">Utilisateur le plus demandeur</th>
                            <th class="text-right">Nb demandes</th>
                            <th class="text-left">Utilisateur le moins demandeur</th>
                            <th class="text-right">Nb demandes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Hebdomadaire</td>
                            <td>{{ weeklyExtremes.max ? getUserName(weeklyExtremes.max.user) : '-' }}</td>
                            <td class="text-right">{{ weeklyExtremes.max?.count || 0 }}</td>
                            <td>{{ weeklyExtremes.min ? getUserName(weeklyExtremes.min.user) : '-' }}</td>
                            <td class="text-right">{{ weeklyExtremes.min?.count || 0 }}</td>
                        </tr>
                        <tr>
                            <td>Mensuelle</td>
                            <td>{{ monthlyExtremes.max ? getUserName(monthlyExtremes.max.user) : '-' }}</td>
                            <td class="text-right">{{ monthlyExtremes.max?.count || 0 }}</td>
                            <td>{{ monthlyExtremes.min ? getUserName(monthlyExtremes.min.user) : '-' }}</td>
                            <td class="text-right">{{ monthlyExtremes.min?.count || 0 }}</td>
                        </tr>
                        <tr>
                            <td>Annuelle</td>
                            <td>{{ yearlyExtremes.max ? getUserName(yearlyExtremes.max.user) : '-' }}</td>
                            <td class="text-right">{{ yearlyExtremes.max?.count || 0 }}</td>
                            <td>{{ yearlyExtremes.min ? getUserName(yearlyExtremes.min.user) : '-' }}</td>
                            <td class="text-right">{{ yearlyExtremes.min?.count || 0 }}</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>

        <v-col cols="12" md="6">
            <UiParentCard title="Utilisateurs par Rôle" style="padding: 2rem;">
                <v-table :loading="loading">
                    <thead>
                        <tr>
                            <th class="text-left">Rôle</th>
                            <th class="text-right">Nombre</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="role in roleDistribution" :key="role.role">
                            <td>{{ role.role }}</td>
                            <td class="text-right">{{ role.count }}</td>
                        </tr>
                        <tr v-if="roleDistribution.length === 0 && !loading">
                            <td colspan="2" class="text-center text-medium-emphasis">Aucune donnée.</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>

        <v-col cols="12" md="6">
            <UiParentCard title="Propositions et Indicateurs Complémentaires" style="padding: 2rem;">
                <v-list density="compact">
                    <v-list-item>
                        <v-list-item-title><strong>Taux d'approbation global:</strong> {{ approvalRate }}%</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                        <v-list-item-title><strong>Demandes en attente:</strong> {{ pendingCount }}</v-list-item-title>
                    </v-list-item>
                    <v-list-item>
                        <v-list-item-title><strong>Utilisateurs inactifs (année):</strong> {{ inactiveUsersYear }}</v-list-item-title>
                    </v-list-item>
                </v-list>

                <v-divider class="my-3" />
                <div class="text-subtitle-1 font-weight-bold mb-2">Top 5 demandeurs (annuel)</div>
                <v-table density="compact">
                    <thead>
                        <tr>
                            <th class="text-left">Utilisateur</th>
                            <th class="text-right">Demandes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in topYearUsers" :key="row.id">
                            <td>{{ getUserName(row.user) }}</td>
                            <td class="text-right">{{ row.count }}</td>
                        </tr>
                        <tr v-if="topYearUsers.length === 0 && !loading">
                            <td colspan="2" class="text-center text-medium-emphasis">Aucune donnée.</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
