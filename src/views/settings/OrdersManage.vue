<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { EyeIcon, CheckIcon, TrashIcon, PencilIcon, PrinterIcon } from 'vue-tabler-icons';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

interface Ordonance {
    id_ordonance: string;
    id_entreprise: string;
    id_users: string;
    compte_budgetaire: string;
    imputation_budgetaire: string;
    reference_op: string;
    date: string;
    creancier: string;
    montant_brut: number;
    acompte: number;
    ir: number;
    tva: number;
    nap: number;
    nbre_pages_jointes: number;
    observations: string;
    status: string;
    approved_by?: string | null;
    approved_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

const toast = useToast();
const page = ref({ title: 'Ordonnances de Paiement' });
const breadcrumbs = ref([
    { title: 'Gestion', disabled: false, href: '#' },
    { title: 'Ordonnances', disabled: true, href: '#' }
]);

const loading = ref(false);
const submitting = ref(false);
const orders = ref<Ordonance[]>([]);
const search = ref('');
const currentUser = ref<any>(null);
const company = ref<any>(null);
const isViewDialogOpen = ref(false);
const isDeleteDialogOpen = ref(false);
const isDrawerOpen = ref(false);
const selectedOrder = ref<Ordonance | null>(null);
const orderToDelete = ref<Ordonance | null>(null);
const editedOrderId = ref<string | null>(null);
const orderForm = ref<HTMLFormElement | null>(null);

const orderModel = ref({
    compte_budgetaire: '',
    imputation_budgetaire: '',
    reference_op: '',
    date: new Date().toISOString().slice(0, 10),
    creancier: '',
    montant_brut: 0,
    acompte: 0,
    ir: 0,
    tva: 0,
    nap: 0,
    nbre_pages_jointes: 0,
    observations: ''
});

const normalizeOrders = (payload: any): Ordonance[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

const resetModel = () => {
    orderModel.value = {
        compte_budgetaire: '',
        imputation_budgetaire: '',
        reference_op: '',
        date: new Date().toISOString().slice(0, 10),
        creancier: '',
        montant_brut: 0,
        acompte: 0,
        ir: 0,
        tva: 0,
        nap: 0,
        nbre_pages_jointes: 0,
        observations: ''
    };
};

const fetchOrders = async () => {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/ordonances');
        orders.value = normalizeOrders(response.data);
    } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Erreur lors du chargement des ordonnances.');
    } finally {
        loading.value = false;
    }
};

const fetchCurrentUser = async () => {
    try {
        const response = await axiosInstance.get('/user');
        currentUser.value = response.data;
        if (currentUser.value?.id_entreprise) {
            const compRes = await axiosInstance.get(`/entreprises/${currentUser.value.id_entreprise}`);
            company.value = compRes.data;
        }
    } catch (error) {
        console.error(error);
    }
};

const fetchOrderDetails = async (id: string): Promise<Ordonance | null> => {
    try {
        const response = await axiosInstance.get(`/ordonances/${id}`);
        const data = response.data;
        if (Array.isArray(data)) return data[0] || null;
        if (Array.isArray(data?.data)) return data.data[0] || null;
        return data || null;
    } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Impossible de charger le détail.');
        return null;
    }
};

const filteredOrders = computed(() => {
    const q = search.value.toLowerCase().trim();
    if (!q) return orders.value;
    return orders.value.filter((item) =>
        [item.reference_op, item.creancier, item.compte_budgetaire, item.imputation_budgetaire, item.status]
            .some((v) => String(v || '').toLowerCase().includes(q))
    );
});

const drawerTitle = computed(() => (editedOrderId.value ? "Modifier l'ordonnance" : 'Nouvelle ordonnance'));

const getStatusColor = (status: string) => {
    switch ((status || '').toUpperCase()) {
        case 'APPROVED':
        case 'PAYEE':
            return 'success';
        case 'CANCELED':
        case 'ANNULEE':
            return 'error';
        default:
            return 'warning';
    }
};

const getStatusLabel = (status: string) => {
    const value = (status || '').toLowerCase();
    if (value === 'pending') return 'En attente';
    if (value === 'approved') return 'Approuvée';
    if (value === 'canceled') return 'Annulée';
    return status || 'En attente';
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(Number(value) || 0);
};

const openAddDrawer = () => {
    editedOrderId.value = null;
    resetModel();
    isDrawerOpen.value = true;
};

const openEditDrawer = async (item: Ordonance) => {
    const details = await fetchOrderDetails(item.id_ordonance);
    if (!details) return;
    editedOrderId.value = details.id_ordonance;
    orderModel.value = {
        compte_budgetaire: details.compte_budgetaire || '',
        imputation_budgetaire: details.imputation_budgetaire || '',
        reference_op: details.reference_op || '',
        date: details.date || new Date().toISOString().slice(0, 10),
        creancier: details.creancier || '',
        montant_brut: Number(details.montant_brut) || 0,
        acompte: Number(details.acompte) || 0,
        ir: Number(details.ir) || 0,
        tva: Number(details.tva) || 0,
        nap: Number(details.nap) || 0,
        nbre_pages_jointes: Number(details.nbre_pages_jointes) || 0,
        observations: details.observations || ''
    };
    isDrawerOpen.value = true;
};

const saveOrder = async () => {
    const { valid } = await orderForm.value!.validate();
    if (!valid) return;

    submitting.value = true;
    try {
        if (editedOrderId.value) {
            await axiosInstance.put(`/ordonances/${editedOrderId.value}`, orderModel.value);
            toast.success('Ordonnance mise à jour.');
        } else {
            await axiosInstance.post('/ordonances', orderModel.value);
            toast.success('Ordonnance créée.');
        }
        isDrawerOpen.value = false;
        await fetchOrders();
    } catch (error: any) {
        toast.error(error?.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
        submitting.value = false;
    }
};

const openViewDialog = async (item: Ordonance) => {
    const details = await fetchOrderDetails(item.id_ordonance);
    if (!details) return;
    selectedOrder.value = details;
    isViewDialogOpen.value = true;
};

const approveOrder = async (id: string) => {
    try {
        await axiosInstance.post(`/ordonances/${id}/approve`);
        toast.success('Ordonnance approuvée.');
        isViewDialogOpen.value = false;
        await fetchOrders();
    } catch (error: any) {
        toast.error(error?.response?.data?.message || "Erreur lors de l'approbation.");
    }
};

const openDeleteDialog = (item: Ordonance) => {
    orderToDelete.value = item;
    isDeleteDialogOpen.value = true;
};

const deleteOrder = async () => {
    if (!orderToDelete.value) return;
    try {
        await axiosInstance.delete(`/ordonances/${orderToDelete.value.id_ordonance}`);
        toast.success('Ordonnance supprimée.');
        isDeleteDialogOpen.value = false;
        if (selectedOrder.value?.id_ordonance === orderToDelete.value.id_ordonance) {
        isViewDialogOpen.value = false;
        }
        await fetchOrders();
    } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Impossible de supprimer cette ordonnance.');
    }
};

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org'}${path}`;
};

const printOrder = (item: Ordonance) => {
    const logoUrl = company.value?.logo ? getImageUrl(company.value.logo) : '';
    const date = item.date ? new Date(item.date).toLocaleDateString() : '-';
    const content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1976d2;padding-bottom:15px;margin-bottom:20px;">
                <div>${logoUrl ? `<img src="${logoUrl}" style="max-height:70px;" />` : ''}</div>
                <div style="text-align:right;">
                    <h2 style="margin:0;">ORDONNANCE DE PAIEMENT</h2>
                    <p style="margin:6px 0 0;">Réf: ${item.reference_op || '-'}</p>
                    <p style="margin:4px 0 0;">Date: ${date}</p>
                </div>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Créancier</strong></td><td style="padding:8px;border:1px solid #ddd;">${item.creancier || '-'}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Compte budgétaire</strong></td><td style="padding:8px;border:1px solid #ddd;">${item.compte_budgetaire || '-'}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Imputation budgétaire</strong></td><td style="padding:8px;border:1px solid #ddd;">${item.imputation_budgetaire || '-'}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Montant brut</strong></td><td style="padding:8px;border:1px solid #ddd;">${formatCurrency(item.montant_brut)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Acompte</strong></td><td style="padding:8px;border:1px solid #ddd;">${formatCurrency(item.acompte)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>IR</strong></td><td style="padding:8px;border:1px solid #ddd;">${formatCurrency(item.ir)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>TVA</strong></td><td style="padding:8px;border:1px solid #ddd;">${formatCurrency(item.tva)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>NAP</strong></td><td style="padding:8px;border:1px solid #ddd;">${formatCurrency(item.nap)}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Pages jointes</strong></td><td style="padding:8px;border:1px solid #ddd;">${item.nbre_pages_jointes || 0}</td></tr>
                <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Observations</strong></td><td style="padding:8px;border:1px solid #ddd;">${item.observations || '-'}</td></tr>
            </table>
        </div>
    `;

    const printWindow = window.open('', '', 'height=750,width=900');
    if (!printWindow) {
        toast.error("Impossible d'ouvrir la fenêtre d'impression.");
        return;
    }
    printWindow.document.write(`<html><head><title>Ordonnance ${item.reference_op || ''}</title></head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
};

const printOrdersList = () => {
    const rows = filteredOrders.value;
    if (!rows.length) {
        toast.warning('Aucune ordonnance à imprimer.');
        return;
    }

    const logoUrl = company.value?.logo ? getImageUrl(company.value.logo) : '';

    const rowsHtml = rows
        .map((item) => {
            return `
                <tr>
                    <td style="border:1px solid #d1d5db; padding:8px;">${item.reference_op || '-'}</td>
                    <td style="border:1px solid #d1d5db; padding:8px;">${item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                    <td style="border:1px solid #d1d5db; padding:8px;">${item.creancier || '-'}</td>
                    <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${formatCurrency(item.montant_brut)}</td>
                    <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${formatCurrency(item.nap)}</td>
                    <td style="border:1px solid #d1d5db; padding:8px;">${getStatusLabel(item.status)}</td>
                </tr>
            `;
        })
        .join('');

    const content = `
        <div style="font-family: Arial, sans-serif; color:#111827; padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:2px solid #e5e7eb; padding-bottom:12px;">
                <div>
                    ${logoUrl ? `<img src="${logoUrl}" style="max-height:70px; max-width:180px;" />` : ''}
                    <div style="margin-top:8px; font-size:13px;"><strong>Liste des ordonnances</strong></div>
                </div>
                <div style="text-align:right; font-size:12px;">
                    <div>Imprimé le: ${new Date().toLocaleString()}</div>
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f3f4f6;">
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Référence</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Date</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Créancier</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Montant brut</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">NAP</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Statut</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;

    const printWindow = window.open('', '', 'height=900,width=1200');
    if (!printWindow) {
        toast.error("Impossible d'ouvrir la fenêtre d'impression.");
        return;
    }
    printWindow.document.write(`<html><head><title>Liste des ordonnances</title></head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
};

onMounted(async () => {
    await fetchCurrentUser();
    await fetchOrders();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs" />
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Gestion des Ordonnances" style="padding: 2rem;">
                <template #action>
                    <div class="d-flex ga-2">
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printOrdersList">Imprimer / PDF</v-btn>
                        <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddDrawer">Nouvelle ordonnance</v-btn>
                    </div>
                </template>

                <v-text-field
                    v-model="search"
                    prepend-inner-icon="mdi-magnify"
                    label="Rechercher (référence, créancier, statut...)"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-4"
                />

                <v-table :loading="loading">
                    <thead>
                        <tr>
                            <th class="text-left">Référence</th>
                            <th class="text-left">Date</th>
                            <th class="text-left">Créancier</th>
                            <th class="text-right">Montant brut</th>
                            <th class="text-right">NAP</th>
                            <th class="text-left">Statut</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in filteredOrders" :key="item.id_ordonance">
                            <td>{{ item.reference_op || '-' }}</td>
                            <td>{{ item.date ? new Date(item.date).toLocaleDateString() : '-' }}</td>
                            <td>{{ item.creancier || '-' }}</td>
                            <td class="text-right">{{ formatCurrency(item.montant_brut) }}</td>
                            <td class="text-right">{{ formatCurrency(item.nap) }}</td>
                            <td>
                                <v-chip size="small" label :color="getStatusColor(item.status)">{{ getStatusLabel(item.status) }}</v-chip>
                            </td>
                            <td class="text-right">
                                <v-btn icon variant="text" color="info" size="small" @click="openViewDialog(item)">
                                    <EyeIcon size="18" />
                                </v-btn>
                                <v-btn
                                    v-if="(item.status || '').toLowerCase() === 'pending'"
                                    icon
                                    variant="text"
                                    color="primary"
                                    size="small"
                                    @click="openEditDrawer(item)"
                                >
                                    <PencilIcon size="18" />
                                </v-btn>
                                <v-btn
                                    v-if="(item.status || '').toLowerCase() === 'pending'"
                                    icon
                                    variant="text"
                                    color="error"
                                    size="small"
                                    @click="openDeleteDialog(item)"
                                >
                                    <TrashIcon size="18" />
                                </v-btn>
                            </td>
                        </tr>
                        <tr v-if="filteredOrders.length === 0 && !loading">
                            <td colspan="7" class="text-center text-medium-emphasis py-4">Aucune ordonnance trouvée.</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>

        <v-navigation-drawer v-model="isDrawerOpen" temporary location="right" width="520">
            <div class="pa-5">
                <div class="d-flex justify-space-between align-center mb-4">
                    <h3 class="text-h5">{{ drawerTitle }}</h3>
                    <v-btn icon="mdi-close" variant="text" @click="isDrawerOpen = false" />
                </div>

                <v-form ref="orderForm" @submit.prevent="saveOrder">
                    <v-row>
                        <v-col cols="12" md="6">
                            <v-label class="mb-1">Compte budgétaire</v-label>
                            <v-text-field v-model="orderModel.compte_budgetaire" variant="outlined" :rules="[v => !!v || 'Requis']" />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-label class="mb-1">Imputation budgétaire</v-label>
                            <v-text-field v-model="orderModel.imputation_budgetaire" variant="outlined" :rules="[v => !!v || 'Requis']" />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-label class="mb-1">Référence OP</v-label>
                            <v-text-field v-model="orderModel.reference_op" variant="outlined" :rules="[v => !!v || 'Requis']" />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-label class="mb-1">Date</v-label>
                            <v-text-field v-model="orderModel.date" type="date" variant="outlined" :rules="[v => !!v || 'Requis']" />
                        </v-col>
                        <v-col cols="12">
                            <v-label class="mb-1">Créancier</v-label>
                            <v-text-field v-model="orderModel.creancier" variant="outlined" :rules="[v => !!v || 'Requis']" />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-label class="mb-1">Montant brut</v-label>
                            <v-text-field v-model.number="orderModel.montant_brut" type="number" min="0" variant="outlined" />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-label class="mb-1">Acompte</v-label>
                            <v-text-field v-model.number="orderModel.acompte" type="number" min="0" variant="outlined" />
                        </v-col>
                        <v-col cols="12" md="4">
                            <v-label class="mb-1">IR</v-label>
                            <v-text-field v-model.number="orderModel.ir" type="number" min="0" variant="outlined" />
                        </v-col>
                        <v-col cols="12" md="4">
                            <v-label class="mb-1">TVA</v-label>
                            <v-text-field v-model.number="orderModel.tva" type="number" min="0" variant="outlined" />
                        </v-col>
                        <v-col cols="12" md="4">
                            <v-label class="mb-1">NAP</v-label>
                            <v-text-field v-model.number="orderModel.nap" type="number" min="0" variant="outlined" />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-label class="mb-1">Pages jointes</v-label>
                            <v-text-field v-model.number="orderModel.nbre_pages_jointes" type="number" min="0" variant="outlined" />
                        </v-col>
                        <v-col cols="12">
                            <v-label class="mb-1">Observations</v-label>
                            <v-textarea v-model="orderModel.observations" rows="3" variant="outlined" />
                        </v-col>
                    </v-row>
                    <v-btn type="submit" color="primary" block :loading="submitting">Enregistrer</v-btn>
                </v-form>
            </div>
        </v-navigation-drawer>

        <v-dialog v-model="isViewDialogOpen" max-width="760">
            <v-card v-if="selectedOrder">
                <v-card-title class="d-flex justify-space-between align-center">
                    Détail ordonnance
                    <v-btn icon="mdi-close" variant="text" @click="isViewDialogOpen = false" />
                </v-card-title>
                <v-card-text>
                    <v-row>
                        <v-col cols="12" md="6"><strong>Référence:</strong> {{ selectedOrder.reference_op || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Date:</strong> {{ selectedOrder.date ? new Date(selectedOrder.date).toLocaleDateString() : '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Créancier:</strong> {{ selectedOrder.creancier || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Statut:</strong> {{ getStatusLabel(selectedOrder.status) }}</v-col>
                        <v-col cols="12" md="6"><strong>Compte:</strong> {{ selectedOrder.compte_budgetaire || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Imputation:</strong> {{ selectedOrder.imputation_budgetaire || '-' }}</v-col>
                        <v-col cols="12" md="4"><strong>Montant brut:</strong> {{ formatCurrency(selectedOrder.montant_brut) }}</v-col>
                        <v-col cols="12" md="4"><strong>Acompte:</strong> {{ formatCurrency(selectedOrder.acompte) }}</v-col>
                        <v-col cols="12" md="4"><strong>NAP:</strong> {{ formatCurrency(selectedOrder.nap) }}</v-col>
                        <v-col cols="12"><strong>Observations:</strong> {{ selectedOrder.observations || '-' }}</v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn variant="outlined" color="secondary" @click="printOrder(selectedOrder)">
                        <PrinterIcon size="16" class="mr-2" /> Imprimer
                    </v-btn>
                    <v-btn
                        v-if="(selectedOrder.status || '').toLowerCase() === 'pending'"
                        color="success"
                        @click="approveOrder(selectedOrder.id_ordonance)"
                    >
                        <CheckIcon size="16" class="mr-2" /> Approuver
                    </v-btn>
                    <v-btn
                        v-if="(selectedOrder.status || '').toLowerCase() === 'pending'"
                        color="error"
                        variant="outlined"
                        @click="openDeleteDialog(selectedOrder)"
                    >
                        <TrashIcon size="16" class="mr-2" /> Supprimer
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="isDeleteDialogOpen" max-width="500">
            <v-card>
                <v-card-title>Confirmer la suppression</v-card-title>
                <v-card-text>
                    Supprimer l'ordonnance <strong>{{ orderToDelete?.reference_op || '-' }}</strong> ?
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="isDeleteDialogOpen = false">Annuler</v-btn>
                    <v-btn color="error" @click="deleteOrder">Supprimer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>

                    
