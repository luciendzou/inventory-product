<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const loading = ref(true);
const product = ref<any>(null);
const categories = ref<any[]>([]);
const brands = ref<any[]>([]);
const suppliers = ref<any[]>([]);
const users = ref<any[]>([]);
const tab = ref('infos');
const movements = ref<any[]>([]);

const page = ref({ title: 'Détails du produit' });
const breadcrumbs = ref([
    { title: 'Produits', disabled: false, href: '/products/list-products' },
    { title: 'Détails', disabled: true, href: '#' }
]);

const fetchData = async () => {
    loading.value = true;
    try {
        const [productRes, catRes, brandRes, supRes, usersRes] = await Promise.all([
            axiosInstance.get(`/products/${route.params.id}`),
            axiosInstance.get('/categories'),
            axiosInstance.get('/brands'),
            axiosInstance.get('/fournisseurs'),
            axiosInstance.get('/users')
        ]);

        product.value = productRes.data;
        categories.value = catRes.data;
        brands.value = brandRes.data;
        suppliers.value = supRes.data;
        users.value = usersRes.data;

        page.value.title = product.value.nom;

        // Charger l'historique des mouvements
        try {
            const historyRes = await axiosInstance.get(`/products/${route.params.id}/movements`);
            const data = historyRes.data;

            const entries = (data.entries || []).map((e: any) => ({
                date: e.date_reception,
                type: 'ENTREE',
                quantite: e.quantite_entree,
                motif: 'Réception'
            }));

            const exits = (data.exits || []).map((e: any) => ({
                date: e.date_sortie,
                type: 'SORTIE',
                quantite: e.quantite_sortie,
                motif: e.id_users ? `Sortie vers ${getUserName(e.id_users)}` : (e.statut_direction || 'Sortie')
            }));

            movements.value = [...entries, ...exits].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } catch (e) {
            console.warn("Impossible de charger l'historique", e);
            movements.value = [];
        }
    } catch (error) {
        toast.error("Impossible de charger les données du produit.");
        router.push('/products/list-products');
    } finally {
        loading.value = false;
    }
};

const getCategoryName = (id: string) => {
    if (!id) return '-';
    const found = categories.value.find(c => c.id_categorie === id);
    return found ? found.name_cat : 'Inconnue';
};

const getBrandName = (id: string) => {
    if (!id) return '-';
    const found = brands.value.find(b => b.id_marque === id);
    return found ? found.nom : 'Inconnue';
};

const getSupplierName = (id: string) => {
    if (!id) return '-';
    const found = suppliers.value.find(s => s.id_fournisseur === id);
    return found ? found.nom : 'Inconnu';
};

const getUserName = (id: string) => {
    if (!id) return '-';
    const found = users.value.find(u => u.id_users === id);
    return found ? found.name : 'Inconnu';
};

const supplierDetails = computed(() => {
    if (!product.value || !product.value.id_fournisseur) return null;
    return suppliers.value.find(s => s.id_fournisseur === product.value.id_fournisseur);
});

const printPage = () => {
    window.print();
};

onMounted(() => {
    fetchData();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>

    <v-row v-if="loading">
        <v-col cols="12" class="text-center">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </v-col>
    </v-row>

    <v-row v-else-if="product">
        <v-col cols="12" md="8">
            <UiParentCard title="Fiche Produit" :sub-title="`Détails et historique des mouvements pour ${product.nom}`" style="padding: 2rem;">
                <template v-slot:action>
                    <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                </template>
                <v-tabs v-model="tab" color="primary">
                    <v-tab value="infos">Informations</v-tab>
                    <v-tab value="history">Historique des mouvements</v-tab>
                </v-tabs>

                <v-window v-model="tab" class="mt-4">
                    <v-window-item value="infos">
                        <v-table>
                            <tbody>
                                <tr>
                                    <td class="font-weight-bold">Nom</td>
                                    <td>{{ product.nom }}</td>
                                </tr>
                                <tr>
                                    <td class="font-weight-bold">Référence</td>
                                    <td>{{ product.reference }}</td>
                                </tr>
                                <tr>
                                    <td class="font-weight-bold">Conditionnement</td>
                                    <td>{{ product.conditionnement || '-' }}</td>
                                </tr>
                                <tr>
                                    <td class="font-weight-bold">Description</td>
                                    <td>{{ product.description || '-' }}</td>
                                </tr>
                                <tr>
                                    <td class="font-weight-bold">Agence</td>
                                    <td>{{ product.agence || '-' }}</td>
                                </tr>
                                <tr>
                                    <td class="font-weight-bold">Catégorie</td>
                                    <td>{{ getCategoryName(product.id_categorie) }}</td>
                                </tr>
                                <tr>
                                    <td class="font-weight-bold">Marque</td>
                                    <td>{{ getBrandName(product.id_marque) }}</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>

                    <v-window-item value="history">
                        <v-table>
                            <thead>
                                <tr>
                                    <th class="text-left">Date</th>
                                    <th class="text-left">Type</th>
                                    <th class="text-left">Quantité</th>
                                    <th class="text-left">Observation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(move, index) in movements" :key="index">
                                    <td>{{ new Date(move.created_at || move.date).toLocaleDateString() }}</td>
                                    <td>
                                        <v-chip size="small" :color="move.type === 'ENTREE' ? 'success' : 'error'">
                                            {{ move.type }}
                                        </v-chip>
                                    </td>
                                    <td>{{ move.quantite }}</td>
                                    <td>{{ move.motif || '-' }}</td>
                                </tr>
                                <tr v-if="movements.length === 0">
                                    <td colspan="4" class="text-center text-medium-emphasis py-4">
                                        Aucun mouvement enregistré pour le moment.
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-window-item>
                </v-window>
            </UiParentCard>
        </v-col>

        <v-col cols="12" md="4">
            <UiParentCard title="État du Stock">
                <div class="text-center py-4">
                    <h2 class="text-h2 font-weight-bold text-primary">{{ product.quantite_stock }}</h2>
                    <p class="text-subtitle-1">Unités en stock</p>
                    <v-chip class="mt-2"
                        :color="product.quantite_stock <= product.quantite_min_alerte ? 'error' : 'success'">
                        {{ product.quantite_stock <= product.quantite_min_alerte ? 'Stock Faible' : 'Stock Suffisant' }}
                            </v-chip>
                </div>
                <v-divider class="my-3"></v-divider>
                <div class="d-flex justify-space-between px-4">
                    <span>Seuil d'alerte :</span>
                    <strong>{{ product.quantite_min_alerte }}</strong>
                </div>
                <v-divider class="my-3"></v-divider>
                <div v-if="supplierDetails" class="pa-4">
                    <div class="d-flex justify-space-between align-center mb-4">
                        <v-avatar color="primary" variant="tonal" size="40" class="mr-3">
                            <v-icon>mdi-truck-outline</v-icon>
                        </v-avatar>
                        <div>
                            <h6 class="text-h6">{{ supplierDetails.nom }}</h6>
                            <div class="text-subtitle-1 text-medium-emphasis">{{ supplierDetails.contact_nom }}</div>
                        </div>
                        <div>
                            <h6 class="text-h12">{{ supplierDetails.email || '-' }}</h6>
                            <div class="text-h12 text-medium-emphasis" style="font-size: 10px;">{{ supplierDetails.telephone || '-' }}</div>
                        </div>
                    </div>
                </div>
                <div v-else class="text-center text-medium-emphasis font-italic py-4">
                    Aucun fournisseur associé
                </div>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
