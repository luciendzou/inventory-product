<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { PencilIcon, TrashIcon } from 'vue-tabler-icons';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
// Breadcrumb
const page = ref({ title: 'Liste des Catégories' });
const breadcrumbs = ref([
    {
        title: 'Produits',
        disabled: false,
        href: '#'
    },
    {
        title: 'Liste des catégories',
        disabled: true,
        href: '#'
    }
]);

// --- Formulaire de création ---
const isDrawerOpen = ref(false);
const categoryForm = ref<HTMLFormElement | null>(null);
const isFormLoading = ref(false);
const newCategoryName = ref('');
const newCategoryType = ref('');
const editedCategory = ref<Category | null>(null);

const categoryTypes = ref([
    'Fourniture de bureau',
    'Fourniture electrique',
    'Fourniture informatique',
    'Fourniture bancaire',
    "Fourniture d'entretien"
]);

const drawerTitle = computed(() => {
    return editedCategory.value ? 'Modifier une catégorie' : 'Ajouter une catégorie';
});

// Définition du type pour une catégorie
interface Category {
    id_categorie: string;
    name_cat: string;
    type: string;
    agence?: string | null;
    id_pole?: string | null;
}

const categories = ref<Category[]>([]);
const loading = ref(true);
const currentUser = ref<any>(null);
const profils = ref<any[]>([]);

// --- Suppression ---
const isDeleteDialogOpen = ref(false);
const categoryToDelete = ref<Category | null>(null);

const fetchCategories = async () => {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/categories');
        let data = response.data;

        // Filtrage par agence
        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find(p => p.id_profil === profileId);
        const role = userProfile?.nom?.toLowerCase();

        if (role && !['direction', 'contrôle', 'controle', 'admin'].some(r => role.includes(r))) {
            const userAgence = currentUser.value?.agence;
            const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

            if (userAgence || userPoleId) {
                data = data.filter((c: Category) => {
                    const matchAgence = userAgence && c.agence === userAgence;
                    const matchPole = userPoleId && c.id_pole === userPoleId;
                    return matchAgence || matchPole;
                });
            }
        }
        categories.value = data;
    } catch (error) {
        toast.error("Impossible de charger les catégories.");
        console.error(error);
    } finally {
        loading.value = false;
    }
};

const fetchCurrentUser = async () => {
    try {
        const response = await axiosInstance.get('/user');
        currentUser.value = response.data;
    } catch (error) {
        console.error("Erreur chargement utilisateur", error);
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

const printPage = () => {
    window.print();
};

onMounted(async () => {
    await Promise.all([fetchCurrentUser(), fetchProfils()]);
    await fetchCategories();
});

const openAddDrawer = () => {
    editedCategory.value = null;
    // Réinitialiser le formulaire avant d'ouvrir
    newCategoryName.value = '';
    newCategoryType.value = '';
    isDrawerOpen.value = true;
};

const openEditDrawer = (item: Category) => {
    editedCategory.value = item;
    newCategoryName.value = item.name_cat;
    newCategoryType.value = item.type;
    isDrawerOpen.value = true;
};

const saveCategory = async () => {
    const { valid } = await categoryForm.value!.validate();
    if (!valid) return;

    isFormLoading.value = true;
    try {
        if (editedCategory.value) {
            // --- Modification ---
            const payload = {
                name_cat: newCategoryName.value,
                type: newCategoryType.value,
                agence: editedCategory.value.agence || currentUser.value?.agence || '',
                id_pole: editedCategory.value.id_pole || currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole || null
            };
            await axiosInstance.put(`/categories/${editedCategory.value.id_categorie}`, payload);
            toast.success('Catégorie modifiée avec succès !');
        } else {
            // --- Création ---
            const payload = {
                name_cat: newCategoryName.value,
                type: newCategoryType.value,
                agence: currentUser.value?.agence || '',
                id_pole: currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole || null
            };
            await axiosInstance.post('/categories', payload);
            toast.success('Catégorie créée avec succès !');
        }
        isDrawerOpen.value = false;
        await fetchCategories(); // Rafraîchir la liste
    } catch (error) {
        const action = editedCategory.value ? 'modification' : 'création';
        toast.error(`Erreur lors de la ${action} de la catégorie.`);
        console.error(error);
    } finally {
        isFormLoading.value = false;
    }
};

const openDeleteDialog = (item: Category) => {
    categoryToDelete.value = item;
    isDeleteDialogOpen.value = true;
};

const deleteCategory = async () => {
    if (!categoryToDelete.value) return;

    try {
        await axiosInstance.delete(`/categories/${categoryToDelete.value.id_categorie}`);
        toast.success('Catégorie supprimée avec succès !');
        isDeleteDialogOpen.value = false;
        await fetchCategories(); // Rafraîchir la liste
    } catch (error) {
        toast.error("Erreur lors de la suppression de la catégorie.");
        console.error(error);
    } finally {
        categoryToDelete.value = null;
    }
};

</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Catégories de produits" style="padding: 2rem;">
                <template v-slot:action>
                    <div class="d-flex ga-2">
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                        <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddDrawer">Ajouter une catégorie</v-btn>
                    </div>
                </template>

                <v-table class="mt-5" :loading="loading" loading-text="Chargement des catégories...">
                    <thead>
                        <tr>
                            <th class="text-left text-uppercase">Nom</th>
                            <th class="text-left text-uppercase">Description</th>
                            <th class="text-right text-uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody v-if="!loading">
                        <tr v-for="item in categories" :key="item.id_categorie">
                            <td>{{ item.name_cat }}</td>
                            <td>{{ item.type }}</td>
                            <td class="text-right">
                                <v-btn icon variant="text" color="primary" @click="openEditDrawer(item)">
                                    <PencilIcon size="20" />
                                </v-btn>
                                <v-btn icon variant="text" color="error" @click="openDeleteDialog(item)">
                                    <TrashIcon size="20" />
                                </v-btn>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>

        <!-- Drawer pour ajouter une catégorie -->
        <v-navigation-drawer v-model="isDrawerOpen" location="right" temporary width="400">
            <div class="pa-5">
                <div class="d-flex justify-space-between align-center mb-5">
                    <h3 class="text-h5">{{ drawerTitle }}</h3>
                    <v-btn icon="mdi-close" variant="text" @click="isDrawerOpen = false"></v-btn>
                </div>

                <v-form ref="categoryForm" @submit.prevent="saveCategory">
                    <v-label class="font-weight-bold mb-1">Nom de la catégorie</v-label>
                    <v-text-field v-model="newCategoryName" variant="outlined" color="primary"
                        :rules="[v => !!v || 'Le nom est requis']"></v-text-field>

                    <v-label class="font-weight-bold mb-1">Type</v-label>
                    <v-select v-model="newCategoryType" :items="categoryTypes" variant="outlined" color="primary"
                        :rules="[v => !!v || 'Le type est requis']"></v-select>

                    <v-btn color="primary" type="submit" block class="mt-4" :loading="isFormLoading">
                        Enregistrer
                    </v-btn>
                </v-form>
            </div>
        </v-navigation-drawer>

        <!-- Dialogue de confirmation de suppression -->
        <v-dialog v-model="isDeleteDialogOpen" max-width="500">
            <v-card>
                <v-card-title class="text-h5">Confirmer la suppression</v-card-title>
                <v-card-text>
                    Êtes-vous sûr de vouloir supprimer la catégorie "<strong>{{ categoryToDelete?.name_cat }}</strong>" ? Cette action est irréversible.
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn text @click="isDeleteDialogOpen = false">Annuler</v-btn>
                    <v-btn color="error" @click="deleteCategory">Supprimer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

    </v-row>
</template>
