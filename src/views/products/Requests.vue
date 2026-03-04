<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { EyeIcon, CheckIcon, XIcon, PlusIcon, TrashIcon, PrinterIcon } from 'vue-tabler-icons';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const page = ref({ title: 'Demandes de matériel' });
const breadcrumbs = ref([
    {
        title: 'Produits',
        disabled: false,
        href: '#'
    },
    {
        title: 'Demandes',
        disabled: true,
        href: '#'
    }
]);

const toast = useToast();
const loading = ref(false);

const tab = ref('my_requests');
const selectedYear = ref(new Date().getFullYear());
const yearOptions = computed(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => current - i);
});
const currentUser = ref<any>(null);
const isAdmin = ref(false);
const company = ref<any>(null);

// --- Visualisation ---
const isViewDialogOpen = ref(false);
const viewRequest = ref<any>(null);
const requestExits = ref<any[]>([]);

// --- Validation / Sortie ---
const isApproveDialogOpen = ref(false);
const requestToApprove = ref<any>(null);
const approvalLines = ref<any[]>([]);

// --- Confirmation Sortie ---
const isExitConfirmDialogOpen = ref(false);
const exitToConfirm = ref<any>(null);

// --- Rejet ---
const isRejectDialogOpen = ref(false);
const requestToReject = ref<any>(null);

interface Demande {
    id_demande: string;
    id_users: string;
    id_entreprise: string;
    date_demande: string;
    statut: string;
    motif: string;
    notes_gestionnaire: string | null;
}

const requests = ref<Demande[]>([]);
const profils = ref<any[]>([]);
const products = ref<any[]>([]);
const users = ref<any[]>([]);

// --- Formulaire de demande ---
const isRequestDrawerOpen = ref(false);
const requestForm = ref<HTMLFormElement | null>(null);
const isRequestLoading = ref(false);
const newRequest = ref({
    motif: '',
    lignes: [{ id_product: null, quantite_demandee: 1 }]
});

const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
        case 'VALIDEE': return 'success';
        case 'REFUSEE': return 'error';
        default: return 'warning';
    }
};

const getStatusLabel = (status: string) => {
    switch (status?.toUpperCase()) {
        case 'VALIDEE': return 'Validée';
        case 'REFUSEE': return 'Refusée';
        case 'EN_ATTENTE': return 'En attente';
        default: return status || 'En attente';
    }
};

const fetchRequests = async () => {
    loading.value = true;
    try {
        let response;
        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find(p => p.id_profil === profileId);
        const role = userProfile?.nom?.toLowerCase();

        if (role && role.includes('agent')) {
            response = await axiosInstance.get(`/demandes/me`);
            requests.value = response.data;
        } else {
            response = await axiosInstance.get('/demandes');
            let data = response.data;

            // Filtrage par agence/pôle pour les non-superviseurs
            if (role && !['direction', 'contrôle', 'controle'].some(r => role.includes(r))) {
                const userAgence = currentUser.value?.agence;
                const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

                if (userAgence || userPoleId) {
                    data = data.filter((req: any) => {
                        const requester = users.value.find(u => u.id_users === req.id_users);
                        if (!requester) return false;

                        const requesterPoleId = requester.id_pole || requester.pole_id || requester.pole?.id_pole;
                        const matchAgence = userAgence && requester.agence === userAgence;
                        const matchPole = userPoleId && requesterPoleId === userPoleId;
                        return matchAgence || matchPole;
                    });
                }
            }
            requests.value = data;
        }
    } catch (error) {
        console.error(error);
        toast.error("Impossible de charger les demandes.");
    } finally {
        loading.value = false;
    }
};

const fetchProfils = async () => {
    try {
        const response = await axiosInstance.get('/profils');
        profils.value = response.data;
    } catch (error) {
        console.error("Erreur chargement profils", error);
    }
};

const fetchProducts = async () => {
    try {
        const response = await axiosInstance.get('/products');
        let data = Array.isArray(response.data) ? response.data : [];

        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find((p) => p.id_profil === profileId);
        const role = (userProfile?.nom || '').toLowerCase();

        // Les profils direction/controle voient tout, les autres sont limites a leur agence/pole
        if (!['direction', 'controle', 'contrôle'].some((r) => role.includes(r))) {
            const userAgence = currentUser.value?.agence;
            const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

            if (userAgence || userPoleId) {
                data = data.filter((p: any) => {
                    const matchAgence = userAgence && p.agence === userAgence;
                    const productPoleId = p.id_pole || p.pole_id || p.pole?.id_pole;
                    const matchPole = userPoleId && productPoleId === userPoleId;
                    return matchAgence || matchPole;
                });
            }
        }

        products.value = data;
    } catch (error) {
        console.error("Erreur chargement produits", error);
    }
};

const fetchUsers = async () => {
    try {
        const response = await axiosInstance.get('/users');
        users.value = response.data;
    } catch (error) {
        console.error("Erreur chargement utilisateurs", error);
    }
};

const fetchCurrentUser = async () => {
    try {
        const response = await axiosInstance.get('/user');
        currentUser.value = response.data;
        // Vérification du rôle administrateur

        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find(p => p.id_profil === profileId);
        const role = userProfile?.nom?.toLowerCase();
        if (role && (role.includes('admin') || role.includes('direction') || role.includes('agence') || role.includes('contrôle') || role.includes('controle'))) {
            isAdmin.value = true;
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de l'utilisateur", error);
    }
};

const fetchCompany = async () => {
    if (currentUser.value && currentUser.value.id_entreprise) {
        try {
            const response = await axiosInstance.get(`/entreprises/${currentUser.value.id_entreprise}`);
            company.value = response.data;
        } catch (error) {
            console.error("Erreur chargement entreprise", error);
        }
    }
};

const filteredRequests = computed(() => {
    let base: Demande[] = [];
    if (tab.value === 'all_requests' && isAdmin.value) {
        base = requests.value;
    } else if (currentUser.value) {
        // Par défaut : Mes demandes
        base = requests.value.filter(r => r.id_users === currentUser.value?.id_users);
    }

    return base.filter((r) => {
        const d = new Date(r.date_demande);
        return !isNaN(d.getTime()) && d.getFullYear() === selectedYear.value;
    });
});

const openRequestDrawer = () => {
    newRequest.value = {
        motif: '',
        lignes: [{ id_product: null, quantite_demandee: 1 }]
    };
    isRequestDrawerOpen.value = true;
    if (products.value.length === 0) {
        fetchProducts();
    }
};

const addLine = () => {
    newRequest.value.lignes.push({ id_product: null, quantite_demandee: 1 });
};

const removeLine = (index: number) => {
    if (newRequest.value.lignes.length > 1) {
        newRequest.value.lignes.splice(index, 1);
    }
};

const getProductName = (id: string) => {
    const p = products.value.find(x => x.id_product === id);
    return p ? p.nom : 'Produit inconnu';
};

const getProductConditionnement = (id: string) => {
    const p = products.value.find(x => x.id_product === id);
    return p?.conditionnement || '-';
};

const getProductStock = (id: string) => {
    const p = products.value.find(x => x.id_product === id);
    return p ? p.quantite_stock : 0;
};

const getUserDetails = (userId: string) => {
    const user = users.value.find(u => u.id_users === userId);
    return user ? { name: user.name, poste: user.poste } : { name: 'Utilisateur inconnu', poste: '' };
};

const saveRequest = async () => {
    const { valid } = await requestForm.value!.validate();
    if (!valid) return;

    isRequestLoading.value = true;
    try {
        await axiosInstance.post('/demandes', newRequest.value);
        toast.success("Demande envoyée avec succès !");
        isRequestDrawerOpen.value = false;
        await fetchRequests();
    } catch (error) {
        toast.error("Erreur lors de l'envoi de la demande.");
        console.error(error);
    } finally {
        isRequestLoading.value = false;
    }
};

const fetchRequestExits = async (id: string) => {
    try {
        const response = await axiosInstance.get(`/demandes/${id}/sorties`);
        requestExits.value = response.data;
    } catch (error) {
        console.error("Erreur chargement sorties", error);
        requestExits.value = [];
    }
};

const openViewDialog = async (item: Demande) => {
    isViewDialogOpen.value = true;
    viewRequest.value = null;
    requestExits.value = [];
    try {
        const response = await axiosInstance.get(`/demandes/${item.id_demande}`);
        viewRequest.value = response.data;
        
        // S'assurer que les produits sont chargés pour afficher les noms
        if (products.value.length === 0) {
            await fetchProducts();
        }

        // Si la demande est validée, on charge les sorties
        if (['VALIDEE'].includes(viewRequest.value.statut?.toUpperCase())) {
            await fetchRequestExits(item.id_demande);
        }
    } catch (error) {
        toast.error("Impossible de charger les détails de la demande.");
        isViewDialogOpen.value = false;
    }
};

const openExitConfirmDialog = (exit: any) => {
    exitToConfirm.value = {
        id_sortie_stock: exit.id_sortie_stock,
        product_name: exit.product ? exit.product.nom : getProductName(exit.id_product),
        conditionnement: exit.product?.conditionnement || getProductConditionnement(exit.id_product),
        quantite_sortie: exit.quantite_sortie,
        quantite_reelle: exit.quantite_sortie
    };
    isExitConfirmDialogOpen.value = true;
};

const submitExitConfirmation = async () => {
    if (!exitToConfirm.value) return;
    try {
        await axiosInstance.post(`/sorties/${exitToConfirm.value.id_sortie_stock}/confirm`, {
            quantite_sortie: exitToConfirm.value.quantite_reelle
        });
        toast.success("Sortie confirmée");
        isExitConfirmDialogOpen.value = false;
        if (viewRequest.value) {
            await fetchRequestExits(viewRequest.value.id_demande);
        }
    } catch (error) {
        toast.error("Erreur confirmation sortie");
    }
};

const rejectExit = async (exitId: string) => {
    try {
        await axiosInstance.post(`/sorties/${exitId}/reject`);
        toast.success("Sortie refusée");
        if (viewRequest.value) {
            await fetchRequestExits(viewRequest.value.id_demande);
        }
    } catch (error) {
        toast.error("Erreur refus sortie");
    }
};

const getExitStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
        case 'CONFIRMEE': return 'success';
        case 'REFUSEE': return 'error';
        default: return 'warning';
    }
};

const openApproveDialog = async (item: Demande) => {
    requestToApprove.value = item;
    isApproveDialogOpen.value = true;
    approvalLines.value = [];
    
    try {
        const response = await axiosInstance.get(`/demandes/${item.id_demande}`);
        const fullRequest = response.data;
        
        approvalLines.value = fullRequest.lignes.map((line: any) => ({
            id_product: line.id_product,
            product_name: line.product ? line.product.nom : getProductName(line.id_product),
            conditionnement: line.product?.conditionnement || getProductConditionnement(line.id_product),
            quantite_demandee: line.quantite_demandee,
            quantite_accordee: line.quantite_demandee
        }));
        
        isApproveDialogOpen.value = true;
    } catch (error) {
        toast.error("Impossible de charger les détails de la demande.");
    }
};

const submitApproval = async () => {
    if (!requestToApprove.value) return;
    
    loading.value = true;
    try {
        const payload = {
            lignes: approvalLines.value.map(l => ({
                id_product: l.id_product,
                quantite_accordee: l.quantite_accordee
            }))
        };
        await axiosInstance.post(`/demandes/${requestToApprove.value.id_demande}/validate`, payload);
        toast.success("Demande validée, sorties créées !");
        isApproveDialogOpen.value = false;
        await fetchRequests();
    } catch (error) {
        console.error(error);
        toast.error("Erreur lors de la validation de la demande.");
    } finally {
        loading.value = false;
    }
};

const openRejectDialog = (item: Demande) => {
    requestToReject.value = item;
    isRejectDialogOpen.value = true;
};

const submitReject = async () => {
    if (!requestToReject.value) return;
    
    loading.value = true;
    try {
        await axiosInstance.post(`/demandes/${requestToReject.value.id_demande}/reject`);
        toast.success("Demande refusée.");
        isRejectDialogOpen.value = false;
        await fetchRequests();
    } catch (error) {
        console.error(error);
        toast.error("Erreur lors du rejet de la demande.");
    } finally {
        loading.value = false;
    }
};

const canDeleteOwnRequest = (item: Demande) => {
    const isOwner = item.id_users === currentUser.value?.id_users;
    const status = (item.statut || '').toUpperCase();
    const isUntreated = !['VALIDEE', 'REFUSEE'].includes(status);
    return isOwner && isUntreated;
};

const deleteOwnRequest = async (item: Demande) => {
    if (!canDeleteOwnRequest(item)) return;
    const confirmed = window.confirm('Supprimer cette demande ?');
    if (!confirmed) return;

    loading.value = true;
    try {
        await axiosInstance.delete(`/demandes/${item.id_demande}`);
        toast.success('Demande supprimée.');
        if (viewRequest.value?.id_demande === item.id_demande) {
            isViewDialogOpen.value = false;
        }
        await fetchRequests();
    } catch (error) {
        console.error(error);
        toast.error('Erreur lors de la suppression de la demande.');
    } finally {
        loading.value = false;
    }
};

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org'}${path}`;
};

const printRequest = () => {
    if (!viewRequest.value) return;
    
    const logoUrl = company.value && company.value.logo ? getImageUrl(company.value.logo) : '';
    const companyName = company.value ? company.value.company_name : 'Inventory Pro';
    const date = new Date(viewRequest.value.date_demande).toLocaleDateString();
    const requester = getUserDetails(viewRequest.value.id_users);
    
    // Construction des lignes HTML
    let linesHtml = '';
    if (viewRequest.value.lignes && viewRequest.value.lignes.length > 0) {
        viewRequest.value.lignes.forEach((line: any, index: number) => {
             const pName = line.product ? line.product.nom : getProductName(line.id_product);
             const pConditionnement = line.product?.conditionnement || getProductConditionnement(line.id_product);
             linesHtml += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${pName}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${pConditionnement}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${line.quantite_demandee}</td>
                </tr>
             `;
        });
    }

    const content = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
                <div>
                    ${logoUrl ? `<img src="${logoUrl}" style="max-height: 80px; max-width: 200px;" />` : ''}
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; color: #666;">DEMANDE DE MATÉRIEL</h2>
                    <p style="margin: 5px 0; color: #888;">#${viewRequest.value.id_demande.substring(0, 8)}</p>
                    <p style="margin: 5px 0;">Date : ${date}</p>
                </div>
            </div>

            <div style="margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 4px;">
                <h3 style="margin-top: 0; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Informations Demandeur</h3>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p><strong>Nom :</strong> ${requester.name}</p>
                    <p><strong>Poste :</strong> ${requester.poste}</p>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p><strong>Motif :</strong> ${viewRequest.value.motif}</p>
                    <p><strong>Statut :</strong> ${getStatusLabel(viewRequest.value.statut)}</p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 50px;">#</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Désignation</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Conditionnement</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 100px;">Quantité</th>
                    </tr>
                </thead>
                <tbody>
                    ${linesHtml}
                </tbody>
            </table>
        </div>
    `;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
        printWindow.document.write(`<html><head><title>Demande ${viewRequest.value.id_demande}</title></head><body>${content}</body></html>`);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
};

onMounted(async () => {
    await fetchProfils();
    await fetchUsers();
    await fetchCurrentUser();
    await fetchCompany();
    await fetchRequests();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Liste des demandes" style="padding: 2rem;">
                <template v-slot:action>
                    <v-btn color="primary" prepend-icon="mdi-plus" @click="openRequestDrawer">Faire une demande</v-btn>
                </template>

                <v-tabs v-model="tab" color="primary" class="mb-4">
                    <v-tab value="my_requests">Mes demandes</v-tab>
                    <v-tab value="all_requests" v-if="isAdmin">Toutes les demandes</v-tab>
                </v-tabs>
                <div class="d-flex justify-end mb-3">
                    <v-select
                        v-model="selectedYear"
                        :items="yearOptions"
                        label="Année"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="max-width: 140px;"
                    />
                </div>

                <v-table class="mt-5" :loading="loading">
                    <thead>
                        <tr>
                            <th class="text-left">Référence</th>
                            <th class="text-left">Demandeur</th>
                            <th class="text-left">Date</th>
                            <th class="text-left">Motif</th>
                            <th class="text-left">Statut</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, index) in filteredRequests" :key="item.id_demande">
                            <td>
                                <v-tooltip :text="item.id_demande" location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <span v-bind="props" class="font-weight-medium">#{{ index + 1 }}</span>
                                    </template>
                                </v-tooltip>
                            </td>
                            <td>
                                <div class="font-weight-bold">{{ getUserDetails(item.id_users).name }}</div>
                                <div class="text-caption text-medium-emphasis">{{ getUserDetails(item.id_users).poste }}</div>
                            </td>
                            <td>{{ new Date(item.date_demande).toLocaleDateString() }}</td>
                            <td>{{ item.motif }}</td>
                            <td>
                                <v-chip :color="getStatusColor(item.statut)" size="small" label>
                                    {{ getStatusLabel(item.statut) }}
                                </v-chip>
                            </td>
                            <td class="text-right">
                                <v-btn icon variant="text" color="info" size="small" title="Voir détails" @click="openViewDialog(item)">
                                    <EyeIcon size="20" />
                                </v-btn>
                                <v-btn
                                    v-if="canDeleteOwnRequest(item)"
                                    icon
                                    variant="text"
                                    color="error"
                                    size="small"
                                    title="Supprimer"
                                    @click="deleteOwnRequest(item)"
                                >
                                    <TrashIcon size="20" />
                                </v-btn>
                                <template
                                    v-if="!['VALIDEE', 'REFUSEE'].includes(item.statut?.toUpperCase())">
                                    <v-btn icon variant="text" color="success" size="small" title="Approuver" @click="openApproveDialog(item)">
                                        <CheckIcon size="20" />
                                    </v-btn>
                                    <v-btn icon variant="text" color="error" size="small" title="Rejeter" @click="openRejectDialog(item)">
                                        <XIcon size="20" />
                                    </v-btn>
                                </template>
                            </td>
                        </tr>
                        <tr v-if="filteredRequests.length === 0 && !loading">
                            <td colspan="6" class="text-center text-medium-emphasis py-4">Aucune demande trouvée.</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>

        <!-- Drawer pour faire une demande -->
        <v-navigation-drawer v-model="isRequestDrawerOpen" location="right" temporary width="600">
            <div class="pa-5">
                <div class="d-flex justify-space-between align-center mb-5">
                    <h3 class="text-h5">Nouvelle demande de matériel</h3>
                    <v-btn icon="mdi-close" variant="text" @click="isRequestDrawerOpen = false"></v-btn>
                </div>

                <v-form ref="requestForm" @submit.prevent="saveRequest">
                    <v-label class="font-weight-bold mb-1">Motif de la demande</v-label>
                    <v-textarea v-model="newRequest.motif" variant="outlined" color="primary" rows="2" :rules="[v => !!v || 'Le motif est requis']"></v-textarea>

                    <div class="d-flex justify-space-between align-center mt-4 mb-2">
                        <h4 class="text-h6">Produits demandés</h4>
                        <v-btn size="small" color="secondary" variant="text" prepend-icon="mdi-plus" @click="addLine">Ajouter une ligne</v-btn>
                    </div>

                    <div v-for="(line, index) in newRequest.lignes" :key="index" class="d-flex align-center mb-2">
                        <v-row dense>
                            <v-col cols="7">
                                <v-autocomplete v-model="line.id_product" :items="products" item-title="nom" item-value="id_product" label="Produit" variant="outlined" density="compact" hide-details :rules="[v => !!v || 'Requis']"></v-autocomplete>
                            </v-col>
                            <v-col cols="3">
                                <v-text-field v-model.number="line.quantite_demandee" type="number" label="Qté" variant="outlined" density="compact" hide-details min="1" :rules="[v => v > 0 || '> 0']"></v-text-field>
                            </v-col>
                            <v-col cols="2" class="d-flex justify-center">
                                <v-btn icon color="error" variant="text" size="small" @click="removeLine(index)" :disabled="newRequest.lignes.length === 1"><TrashIcon size="20" /></v-btn>
                            </v-col>
                        </v-row>
                    </div>

                    <v-btn color="primary" type="submit" block class="mt-6" :loading="isRequestLoading">Envoyer la demande</v-btn>
                </v-form>
            </div>
        </v-navigation-drawer>

        <!-- Dialogue de visualisation -->
        <v-dialog v-model="isViewDialogOpen" max-width="700">
            <v-card>
                <v-card-title class="d-flex justify-space-between align-center">
                    Détails de la demande
                    <v-btn icon="mdi-close" variant="text" @click="isViewDialogOpen = false"></v-btn>
                </v-card-title>
                <v-card-text v-if="viewRequest">
                    <div class="d-flex justify-space-between mb-4">
                        <div>
                            <strong>Demandeur:</strong> {{ getUserDetails(viewRequest.id_users).name }}<br>
                            <strong>Date:</strong> {{ new Date(viewRequest.date_demande).toLocaleDateString() }}<br>
                            <strong>Statut:</strong> <v-chip :color="getStatusColor(viewRequest.statut)" size="x-small" label class="ml-2">{{ getStatusLabel(viewRequest.statut) }}</v-chip>
                        </div>
                        <div class="text-right">
                            <strong>Motif:</strong><br>
                            {{ viewRequest.motif }}
                        </div>
                    </div>

                    <v-table density="compact" class="border rounded">
                        <thead>
                            <tr>
                                <th>Produit</th>
                                <th>Conditionnement</th>
                                <th class="text-center">Quantité</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(line, idx) in viewRequest.lignes" :key="idx">
                                <td>{{ line.product ? line.product.nom : getProductName(line.id_product) }}</td>
                                <td>{{ line.product?.conditionnement || getProductConditionnement(line.id_product) }}</td>
                                <td class="text-center">{{ line.quantite_demandee }}</td>
                            </tr>
                        </tbody>
                    </v-table>

                    <div v-if="requestExits.length > 0" class="mt-4">
                        <v-divider class="mb-4"></v-divider>
                        <h4 class="text-h6 mb-2">Validation des sorties (Par produit)</h4>
                        <v-table density="compact" class="border rounded">
                            <thead>
                                <tr>
                                    <th>Produit</th>
                                    <th>Conditionnement</th>
                                    <th class="text-center">Quantité</th>
                                    <th class="text-center">Statut</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="exit in requestExits" :key="exit.id_sortie_stock">
                                    <td>{{ exit.product ? exit.product.nom : getProductName(exit.id_product) }}</td>
                                    <td>{{ exit.product?.conditionnement || getProductConditionnement(exit.id_product) }}</td>
                                    <td class="text-center">{{ exit.quantite_sortie }}</td>
                                    <td class="text-center">
                                        <v-chip size="x-small" :color="getExitStatusColor(exit.statut_direction || exit.statut)" label>{{ exit.statut_direction || exit.statut || 'En attente' }}</v-chip>
                                    </td>
                                    <td class="text-right">
                                        <template v-if="!['CONFIRMEE', 'REFUSEE'].includes((exit.statut_direction || exit.statut)?.toUpperCase())">
                                            <v-btn icon variant="text" color="success" size="small" title="Confirmer la sortie" @click="openExitConfirmDialog(exit)">
                                                <CheckIcon size="18" />
                                            </v-btn>
                                            <v-btn icon variant="text" color="error" size="small" title="Refuser la sortie" @click="rejectExit(exit.id_sortie_stock)">
                                                <XIcon size="18" />
                                            </v-btn>
                                        </template>
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </div>
                </v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printRequest">Imprimer</v-btn>
                    <v-btn color="primary" @click="isViewDialogOpen = false">Fermer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Dialogue de validation (Sortie de stock) -->
        <v-dialog v-model="isApproveDialogOpen" max-width="800">
            <v-card>
                <v-card-title>Valider la demande</v-card-title>
                <v-card-text>
                    Êtes-vous sûr de vouloir valider cette demande ? <br>
                    Cela générera automatiquement les sorties de stock correspondantes.
                    <v-alert type="info" variant="tonal" class="mb-4" density="compact">
                        Veuillez vérifier et ajuster les quantités accordées si nécessaire.
                    </v-alert>
                    
                    <v-table density="comfortable">
                        <thead>
                            <tr>
                                <th>Produit</th>
                                <th>Conditionnement</th>
                                <th class="text-center">Qté Demandée</th>
                                <th class="text-center" style="width: 150px;">Qté Accordée</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="line in approvalLines" :key="line.id_product">
                                <td>{{ line.product_name }}</td>
                                <td>{{ line.conditionnement || '-' }}</td>
                                <td class="text-center">{{ line.quantite_demandee }}</td>
                                <td>
                                    <v-text-field v-model.number="line.quantite_accordee" type="number" density="compact" variant="outlined" hide-details min="0" :max="line.quantite_demandee"></v-text-field>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn variant="text" @click="isApproveDialogOpen = false">Annuler</v-btn>
                    <v-btn color="success" @click="submitApproval" :loading="loading">Valider</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Dialogue de rejet -->
        <v-dialog v-model="isRejectDialogOpen" max-width="500">
            <v-card>
                <v-card-title class="text-h5">Refuser la demande</v-card-title>
                <v-card-text>
                    Êtes-vous sûr de vouloir refuser cette demande ? Cette action est irréversible.
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="isRejectDialogOpen = false">Annuler</v-btn>
                    <v-btn color="error" @click="submitReject" :loading="loading">Refuser</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Dialogue de confirmation de sortie -->
        <v-dialog v-model="isExitConfirmDialogOpen" max-width="500">
            <v-card v-if="exitToConfirm">
                <v-card-title>Confirmer la sortie</v-card-title>
                <v-card-text>
                    <div class="mb-4">
                        <strong>Produit :</strong> {{ exitToConfirm.product_name }}<br>
                        <strong>Conditionnement :</strong> {{ exitToConfirm.conditionnement || '-' }}<br>
                        <strong>Quantité prévue :</strong> {{ exitToConfirm.quantite_sortie }}
                    </div>
                    <v-label class="font-weight-bold mb-1">Quantité réelle à sortir</v-label>
                    <v-text-field v-model.number="exitToConfirm.quantite_reelle" type="number" variant="outlined" density="compact" min="0" :max="exitToConfirm.quantite_sortie"></v-text-field>
                </v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn variant="text" @click="isExitConfirmDialogOpen = false">Annuler</v-btn>
                    <v-btn color="success" @click="submitExitConfirmation">Confirmer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>        
