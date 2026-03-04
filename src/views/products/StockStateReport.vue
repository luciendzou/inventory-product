<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

type PeriodMode = 'date' | 'interval' | 'year';

interface Product {
    id_product: string;
    nom: string;
    conditionnement?: string | null;
    prix?: number;
    quantite_stock?: number;
    agence?: string | null;
    id_pole?: string | null;
}

interface Entry {
    id_product: string;
    quantite_entree: number;
    prix_achat?: number;
    date_reception: string;
}

interface Exit {
    id_product: string;
    quantite_sortie: number;
    date_sortie: string;
}

const toast = useToast();
const page = ref({ title: 'Etat de Stock par Periode' });
const breadcrumbs = ref([
    { title: 'Rapports', disabled: false, href: '#' },
    { title: 'Etat de stock', disabled: true, href: '#' }
]);

const loading = ref(false);
const search = ref('');
const periodMode = ref<PeriodMode>('interval');

const today = new Date();
const twoDigits = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const todayStr = `${today.getFullYear()}-${twoDigits(today.getMonth() + 1)}-${twoDigits(today.getDate())}`;
const firstDayMonthStr = `${today.getFullYear()}-${twoDigits(today.getMonth() + 1)}-01`;

const dateFrom = ref(firstDayMonthStr);
const dateTo = ref(todayStr);
const singleDate = ref(todayStr);
const selectedYear = ref(today.getFullYear());

const rawProducts = ref<Product[]>([]);
const rawEntries = ref<Entry[]>([]);
const rawExits = ref<Exit[]>([]);
const profils = ref<any[]>([]);
const currentUser = ref<any>(null);
const company = ref<any>(null);

const headers = [
    { title: 'Produit', key: 'nom', align: 'start' as const },
    { title: 'Conditionnement', key: 'conditionnement', align: 'start' as const },
    { title: 'Stock debut', key: 'stock_debut', align: 'end' as const },
    { title: 'Entrees periode', key: 'entrees_periode', align: 'end' as const },
    { title: 'Sorties periode', key: 'sorties_periode', align: 'end' as const },
    { title: 'Stock fin', key: 'stock_fin', align: 'end' as const },
    { title: 'Valeur stock fin', key: 'valeur_stock_fin', align: 'end' as const }
];

const parseDateStart = (value: string) => new Date(`${value}T00:00:00`);
const parseDateEnd = (value: string) => new Date(`${value}T23:59:59`);

const periodBounds = computed(() => {
    if (periodMode.value === 'date') {
        if (!singleDate.value) return null;
        return {
            start: parseDateStart(singleDate.value),
            end: parseDateEnd(singleDate.value),
            label: `Date du ${singleDate.value}`
        };
    }

    if (periodMode.value === 'year') {
        const y = Number(selectedYear.value);
        if (!Number.isFinite(y)) return null;
        return {
            start: new Date(y, 0, 1, 0, 0, 0),
            end: new Date(y, 11, 31, 23, 59, 59),
            label: `Annee ${y}`
        };
    }

    if (!dateFrom.value || !dateTo.value) return null;
    const start = parseDateStart(dateFrom.value);
    const end = parseDateEnd(dateTo.value);
    if (start.getTime() > end.getTime()) return null;
    return {
        start,
        end,
        label: `Du ${dateFrom.value} au ${dateTo.value}`
    };
});

const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value || 0);

const escapeHtml = (value: string) => {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org'}${path}`;
};

const filteredProductsByRole = computed(() => {
    let products = rawProducts.value;
    const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
    const userProfile = profils.value.find((p: any) => p.id_profil === profileId);
    const role = (userProfile?.nom || '').toLowerCase();

    if (role && !['direction', 'controle', 'contrôle'].some((r) => role.includes(r))) {
        const userAgence = currentUser.value?.agence;
        const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

        if (userAgence || userPoleId) {
            products = products.filter((p: any) => {
                const matchAgence = userAgence && p.agence === userAgence;
                const matchPole = userPoleId && p.id_pole === userPoleId;
                return matchAgence || matchPole;
            });
        }
    }

    return products;
});

const reportRows = computed(() => {
    const bounds = periodBounds.value;
    if (!bounds) return [];

    return filteredProductsByRole.value
        .map((p: Product) => {
            const entries = rawEntries.value.filter((e) => e.id_product === p.id_product);
            const exits = rawExits.value.filter((s) => s.id_product === p.id_product);

            const entriesInPeriod = entries
                .filter((e) => {
                    const d = new Date(e.date_reception);
                    return !Number.isNaN(d.getTime()) && d >= bounds.start && d <= bounds.end;
                })
                .reduce((sum, e) => sum + (Number(e.quantite_entree) || 0), 0);

            const exitsInPeriod = exits
                .filter((s) => {
                    const d = new Date(s.date_sortie);
                    return !Number.isNaN(d.getTime()) && d >= bounds.start && d <= bounds.end;
                })
                .reduce((sum, s) => sum + (Number(s.quantite_sortie) || 0), 0);

            const entriesAfterEnd = entries
                .filter((e) => {
                    const d = new Date(e.date_reception);
                    return !Number.isNaN(d.getTime()) && d > bounds.end;
                })
                .reduce((sum, e) => sum + (Number(e.quantite_entree) || 0), 0);

            const exitsAfterEnd = exits
                .filter((s) => {
                    const d = new Date(s.date_sortie);
                    return !Number.isNaN(d.getTime()) && d > bounds.end;
                })
                .reduce((sum, s) => sum + (Number(s.quantite_sortie) || 0), 0);

            const stockCurrent = Number(p.quantite_stock) || 0;
            const stockFin = stockCurrent - entriesAfterEnd + exitsAfterEnd;
            const stockDebut = stockFin - entriesInPeriod + exitsInPeriod;
            const valeurStockFin = stockFin * (Number(p.prix) || 0);

            return {
                id_product: p.id_product,
                nom: p.nom,
                conditionnement: p.conditionnement || '-',
                stock_debut: stockDebut,
                entrees_periode: entriesInPeriod,
                sorties_periode: exitsInPeriod,
                stock_fin: stockFin,
                valeur_stock_fin: valeurStockFin
            };
        })
        .filter((r) => {
            const keyword = search.value.trim().toLowerCase();
            if (!keyword) return true;
            return (r.nom || '').toLowerCase().includes(keyword) || (r.conditionnement || '').toLowerCase().includes(keyword);
        })
        .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
});

const totals = computed(() => {
    return reportRows.value.reduce(
        (acc, row) => {
            acc.stockDebut += row.stock_debut || 0;
            acc.entrees += row.entrees_periode || 0;
            acc.sorties += row.sorties_periode || 0;
            acc.stockFin += row.stock_fin || 0;
            acc.valeurStockFin += row.valeur_stock_fin || 0;
            return acc;
        },
        { stockDebut: 0, entrees: 0, sorties: 0, stockFin: 0, valeurStockFin: 0 }
    );
});

const yearOptions = computed(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => current - i);
});

const fetchData = async () => {
    loading.value = true;
    try {
        const [userRes, profilsRes, productsRes, entriesRes, exitsRes, companyRes] = await Promise.all([
            axiosInstance.get('/user'),
            axiosInstance.get('/profils'),
            axiosInstance.get('/products'),
            axiosInstance.get('/stock/entries'),
            axiosInstance.get('/stock/exits'),
            axiosInstance.get('/entreprises/current').catch(() => null)
        ]);

        currentUser.value = userRes.data;
        profils.value = Array.isArray(profilsRes.data) ? profilsRes.data : [];
        rawProducts.value = Array.isArray(productsRes.data) ? productsRes.data : [];
        rawEntries.value = Array.isArray(entriesRes.data) ? entriesRes.data : [];
        rawExits.value = Array.isArray(exitsRes.data) ? exitsRes.data : [];

        if (companyRes?.data) {
            company.value = companyRes.data;
        } else if (currentUser.value?.id_entreprise) {
            try {
                const res = await axiosInstance.get(`/entreprises/${currentUser.value.id_entreprise}`);
                company.value = res.data;
            } catch {
                company.value = null;
            }
        }
    } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Erreur chargement rapport état de stock.');
    } finally {
        loading.value = false;
    }
};

const exportExcel = () => {
    if (!reportRows.value.length) {
        toast.warning('Aucune donnée à exporter.');
        return;
    }

    const bodyRows = reportRows.value
        .map(
            (row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.nom || '-')}</td>
                <td>${escapeHtml(row.conditionnement || '-')}</td>
                <td style="text-align:right;">${row.stock_debut}</td>
                <td style="text-align:right;">${row.entrees_periode}</td>
                <td style="text-align:right;">${row.sorties_periode}</td>
                <td style="text-align:right;">${row.stock_fin}</td>
                <td style="text-align:right;">${row.valeur_stock_fin}</td>
            </tr>
        `
        )
        .join('');

    const tableHtml = `
        <html>
            <head><meta charset="UTF-8" /></head>
            <body>
                <table border="1" style="border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Produit</th>
                            <th>Conditionnement</th>
                            <th>Stock debut</th>
                            <th>Entrees periode</th>
                            <th>Sorties periode</th>
                            <th>Stock fin</th>
                            <th>Valeur stock fin</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                        <tr>
                            <td colspan="3" style="text-align:right;"><strong>Total</strong></td>
                            <td style="text-align:right;"><strong>${totals.value.stockDebut}</strong></td>
                            <td style="text-align:right;"><strong>${totals.value.entrees}</strong></td>
                            <td style="text-align:right;"><strong>${totals.value.sorties}</strong></td>
                            <td style="text-align:right;"><strong>${totals.value.stockFin}</strong></td>
                            <td style="text-align:right;"><strong>${totals.value.valeurStockFin}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `etat-stock-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const printReport = () => {
    if (!reportRows.value.length) {
        toast.warning('Aucune donnée à imprimer.');
        return;
    }

    const logoUrl = company.value?.logo ? getImageUrl(company.value.logo) : '';
    const agency = currentUser.value?.agence || '-';

    const rowsHtml = reportRows.value
        .map(
            (row, index) => `
            <tr>
                <td style="border:1px solid #d1d5db; padding:8px;">${index + 1}</td>
                <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(row.nom || '-')}</td>
                <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(row.conditionnement || '-')}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${row.stock_debut}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${row.entrees_periode}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${row.sorties_periode}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${row.stock_fin}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(row.valeur_stock_fin))}</td>
            </tr>
        `
        )
        .join('');

    const content = `
        <div style="font-family: Arial, sans-serif; color:#111827; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
                <div>
                    ${logoUrl ? `<img src="${logoUrl}" style="max-height:70px; max-width:180px;" />` : '<div style="font-weight:700; font-size:18px;">Inventory Pro</div>'}
                    <div style="margin-top: 8px; font-size: 13px;"><strong>Agence:</strong> ${escapeHtml(agency)}</div>
                </div>
                <div style="text-align:right; font-size:12px;">
                    <div><strong>Rapport Etat de Stock</strong></div>
                    <div>${escapeHtml(periodBounds.value?.label || '-')}</div>
                    <div>Imprimé le: ${new Date().toLocaleString()}</div>
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse; margin-bottom: 16px;">
                <thead>
                    <tr style="background:#f3f4f6;">
                        <th style="border:1px solid #d1d5db; padding:8px; width:50px;">N°</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Produit</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Conditionnement</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Stock debut</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Entrees periode</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Sorties periode</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Stock fin</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Valeur stock fin</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background:#f9fafb; font-weight:700;">
                        <td colspan="3" style="border:1px solid #d1d5db; padding:8px; text-align:right;">Total</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${totals.value.stockDebut}</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${totals.value.entrees}</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${totals.value.sorties}</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${totals.value.stockFin}</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(totals.value.valeurStockFin))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    const printWindow = window.open('', '', 'height=900,width=1200');
    if (!printWindow) return;

    printWindow.document.write(`
        <html>
            <head><title>Rapport Etat de Stock</title></head>
            <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
};

onMounted(() => {
    fetchData();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs" />
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Etat de Stock par Date / Intervalle / Annee" style="padding: 2rem;">
                <template #action>
                    <div class="d-flex ga-2">
                        <v-btn color="success" variant="outlined" prepend-icon="mdi-file-excel" @click="exportExcel">Exporter Excel</v-btn>
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printReport">Imprimer / PDF</v-btn>
                    </div>
                </template>

                <v-row class="mb-3">
                    <v-col cols="12" md="3">
                        <v-select
                            v-model="periodMode"
                            :items="[
                                { title: 'Intervalle', value: 'interval' },
                                { title: 'Date precise', value: 'date' },
                                { title: 'Annee', value: 'year' }
                            ]"
                            item-title="title"
                            item-value="value"
                            label="Mode periode"
                            variant="outlined"
                            density="compact"
                        />
                    </v-col>

                    <v-col v-if="periodMode === 'interval'" cols="12" md="3">
                        <v-text-field v-model="dateFrom" type="date" label="Date debut" variant="outlined" density="compact" />
                    </v-col>
                    <v-col v-if="periodMode === 'interval'" cols="12" md="3">
                        <v-text-field v-model="dateTo" type="date" label="Date fin" variant="outlined" density="compact" />
                    </v-col>

                    <v-col v-if="periodMode === 'date'" cols="12" md="3">
                        <v-text-field v-model="singleDate" type="date" label="Date demandee" variant="outlined" density="compact" />
                    </v-col>

                    <v-col v-if="periodMode === 'year'" cols="12" md="3">
                        <v-select v-model="selectedYear" :items="yearOptions" label="Annee" variant="outlined" density="compact" />
                    </v-col>

                    <v-col cols="12" md="3">
                        <v-text-field
                            v-model="search"
                            prepend-inner-icon="mdi-magnify"
                            label="Rechercher produit"
                            variant="outlined"
                            density="compact"
                            hide-details
                        />
                    </v-col>
                </v-row>

                <v-alert v-if="!periodBounds" type="warning" variant="tonal" class="mb-3">
                    Parametres de periode invalides. Verifiez vos dates.
                </v-alert>

                <v-data-table :headers="headers" :items="reportRows" :loading="loading" density="comfortable" hover>
                    <template #item.valeur_stock_fin="{ item }">
                        <strong>{{ formatCurrency(item.valeur_stock_fin) }}</strong>
                    </template>
                </v-data-table>

                <div class="d-flex justify-end mt-3" v-if="reportRows.length">
                    <v-chip color="primary" variant="tonal">
                        Total valeur stock fin: {{ formatCurrency(totals.valeurStockFin) }}
                    </v-chip>
                </div>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
