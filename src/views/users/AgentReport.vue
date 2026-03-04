<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();

const page = ref({ title: 'Rapport Agent' });
const breadcrumbs = ref([
    { title: 'Utilisateurs', disabled: false, href: '#' },
    { title: 'Rapport Agent', disabled: true, href: '#' }
]);

const loading = ref(false);
const search = ref('');
const tab = ref('received');
const exits = ref<any[]>([]);
const products = ref<any[]>([]);

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

const getProductName = (item: any) => {
    if (item?.product?.nom) return item.product.nom;
    const found = products.value.find((p: any) => p.id_product === item.id_product);
    return found?.nom || 'Produit inconnu';
};

const fetchData = async () => {
    loading.value = true;
    try {
        const [demandesRes, productsRes] = await Promise.all([
            axiosInstance.get('/demandes/me'),
            axiosInstance.get('/products')
        ]);

        products.value = Array.isArray(productsRes.data) ? productsRes.data : [];
        const demandes = Array.isArray(demandesRes.data) ? demandesRes.data : [];

        const sortiesParDemande = await Promise.all(
            demandes.map(async (d: any) => {
                try {
                    const res = await axiosInstance.get(`/demandes/${d.id_demande}/sorties`);
                    const rows = Array.isArray(res.data) ? res.data : [];
                    return rows.map((s: any) => ({
                        ...s,
                        demande_id: d.id_demande,
                        demande_motif: d.motif || '',
                        statut_final: s.statut_direction || s.statut || d.statut || 'EN_ATTENTE'
                    }));
                } catch {
                    return [];
                }
            })
        );

        exits.value = sortiesParDemande.reduce((acc: any[], items: any[]) => acc.concat(items), []);
    } catch (error) {
        console.error(error);
        toast.error("Impossible de charger le rapport agent.");
    } finally {
        loading.value = false;
    }
};

const receivedRows = computed(() => {
    return exits.value.filter((e: any) => isReceivedStatus(e.statut_final));
});

const refusedRows = computed(() => {
    return exits.value.filter((e: any) => isRefusedStatus(e.statut_final));
});

const filteredRows = computed(() => {
    const list = tab.value === 'refused' ? refusedRows.value : receivedRows.value;
    if (!search.value) return list;
    const s = search.value.toLowerCase();
    return list.filter((item: any) => {
        const productName = getProductName(item).toLowerCase();
        const motif = (item.demande_motif || '').toLowerCase();
        const ref = (item.demande_id || '').toLowerCase();
        return productName.includes(s) || motif.includes(s) || ref.includes(s);
    });
});

const totalReceivedQty = computed(() => {
    return receivedRows.value.reduce((sum: number, item: any) => sum + Number(item.quantite_sortie || 0), 0);
});

const totalRefusedQty = computed(() => {
    return refusedRows.value.reduce((sum: number, item: any) => sum + Number(item.quantite_sortie || 0), 0);
});

const printPage = () => {
    window.print();
};

const exportCsv = () => {
    const rows = (tab.value === 'refused' ? refusedRows.value : receivedRows.value).map((item: any) => ({
        reference_demande: item.demande_id || '',
        date_sortie: item.date_sortie || '',
        produit: getProductName(item),
        quantite: item.quantite_sortie || 0,
        statut: item.statut_final || '',
        motif: item.demande_motif || ''
    }));

    const headers = ['reference_demande', 'date_sortie', 'produit', 'quantite', 'statut', 'motif'];
    const csv = [headers.join(';'), ...rows.map((r: any) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-agent-${tab.value}.csv`;
    link.click();
    URL.revokeObjectURL(url);
};

onMounted(() => {
    fetchData();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>

    <v-row>
        <v-col cols="12" md="6">
            <v-card variant="outlined" class="pa-4">
                <div class="text-subtitle-2 text-medium-emphasis">Produits reçus</div>
                <div class="text-h4 font-weight-bold text-success">{{ receivedRows.length }}</div>
                <div class="text-caption">Quantité totale: {{ totalReceivedQty }}</div>
            </v-card>
        </v-col>
        <v-col cols="12" md="6">
            <v-card variant="outlined" class="pa-4">
                <div class="text-subtitle-2 text-medium-emphasis">Produits refusés</div>
                <div class="text-h4 font-weight-bold text-error">{{ refusedRows.length }}</div>
                <div class="text-caption">Quantité totale: {{ totalRefusedQty }}</div>
            </v-card>
        </v-col>

        <v-col cols="12">
            <UiParentCard title="Détails des produits" style="padding: 2rem;">
                <template v-slot:action>
                    <div class="d-flex ga-2">
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                        <v-btn color="success" variant="outlined" prepend-icon="mdi-file-excel" @click="exportCsv">Exporter Excel (CSV)</v-btn>
                        <v-btn color="primary" variant="outlined" prepend-icon="mdi-refresh" :loading="loading" @click="fetchData">Rafraîchir</v-btn>
                    </div>
                </template>

                <v-tabs v-model="tab" color="primary" class="mb-4">
                    <v-tab value="received">Reçus</v-tab>
                    <v-tab value="refused">Refusés</v-tab>
                </v-tabs>

                <v-text-field
                    v-model="search"
                    prepend-inner-icon="mdi-magnify"
                    label="Rechercher un produit, un motif ou une référence..."
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-4"
                />

                <v-table :loading="loading">
                    <thead>
                        <tr>
                            <th class="text-left">Référence Demande</th>
                            <th class="text-left">Date</th>
                            <th class="text-left">Produit</th>
                            <th class="text-left">Quantité</th>
                            <th class="text-left">Statut</th>
                            <th class="text-left">Motif</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in filteredRows" :key="item.id_sortie_stock">
                            <td>{{ item.demande_id }}</td>
                            <td>{{ item.date_sortie ? new Date(item.date_sortie).toLocaleDateString() : '-' }}</td>
                            <td>{{ getProductName(item) }}</td>
                            <td>{{ item.quantite_sortie }}</td>
                            <td>
                                <v-chip size="small" :color="tab === 'refused' ? 'error' : 'success'">
                                    {{ item.statut_final }}
                                </v-chip>
                            </td>
                            <td>{{ item.demande_motif || '-' }}</td>
                        </tr>
                        <tr v-if="filteredRows.length === 0 && !loading">
                            <td colspan="6" class="text-center text-medium-emphasis py-4">Aucune donnée disponible.</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
