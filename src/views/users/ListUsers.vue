<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { PencilIcon, TrashIcon, EyeIcon } from 'vue-tabler-icons';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
const page = ref({ title: 'Liste des Utilisateurs' });
const breadcrumbs = ref([
    {
        title: 'Utilisateurs',
        disabled: false,
        href: '#'
    },
    {
        title: 'Liste des utilisateurs',
        disabled: true,
        href: '#'
    }
]);

interface User {
    id_users: string;
    name: string;
    email: string;
    phone_number: string;
    poste: string | null;
    matricule: string | null;
    agence: string | null;
    link_img: string | null;
    signature: string | null;
    profil_id: string | null;
    id_pole?: string | null;
    pole_id?: string | null;
    profil: {
        id_profil: string;
        nom: string;
    } | null;
    pole?: {
        id_pole: string;
        nom: string;
    } | null;
}

const users = ref<User[]>([]);
const loading = ref(true);
const currentUser = ref<any>(null);
const profils = ref<any[]>([]);
const poles = ref<any[]>([]);

// --- Suppression ---
const isDeleteDialogOpen = ref(false);
const userToDelete = ref<User | null>(null);

// --- Visualisation ---
const isViewDialogOpen = ref(false);
const viewUser = ref<User | null>(null);

// --- Identifiants créés ---
const isCredentialsModalOpen = ref(false);
const createdCredentials = ref({
    name: '',
    email: '',
    password: ''
});

// --- Formulaire ---
const isDrawerOpen = ref(false);
const userForm = ref<HTMLFormElement | null>(null);
const isFormLoading = ref(false);
const editedUser = ref<User | null>(null);

const userModel = ref({
    name: '',
    email: '',
    phone_number: '',
    poste: '',
    matricule: '',
    agence: '',
    link_img: '',
    signature: '',
    profil_id: null as string | null,
    pole_id: null as string | null
});

const fetchUsers = async () => {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/users');
        let data = response.data;

        // Get current user's role
        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find(p => p.id_profil === profileId);
        const role = userProfile?.nom?.toLowerCase();

        // Filter if not Direction or Controle
        if (role && !['direction', 'contrôle', 'controle'].some(r => role.includes(r))) {
            const userAgence = currentUser.value?.agence;
            // Filter users to only show those from the same agency.
            // This will also work if userAgence is null or empty string.
            data = data.filter((user: User) => user.agence === userAgence);
        }

        users.value = data;
    } catch (error) {
        toast.error("Impossible de charger les utilisateurs.");
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

const fetchPoles = async () => {
    try {
        const response = await axiosInstance.get('/poles');
        poles.value = response.data;
    } catch (error) {
        console.error("Erreur chargement pôles", error);
    }
};

const getPoleName = (user: User) => {
    if (user.pole && user.pole.nom) return user.pole.nom;
    const poleId = user.id_pole || user.pole_id;
    if (poleId) {
        const found = poles.value.find((p: any) => p.id_pole === poleId);
        return found ? found.nom : null;
    }
    return null;
};

const drawerTitle = computed(() => {
    return editedUser.value ? "Modifier l'utilisateur" : "Ajouter un utilisateur";
});

const openAddDrawer = () => {
    editedUser.value = null;
    userModel.value = {
        name: '',
        email: '',
        phone_number: '',
        poste: '',
        matricule: '',
        agence: '',
        link_img: '',
        signature: '',
        profil_id: null,
        pole_id: null
    };
    isDrawerOpen.value = true;
};

const openEditDrawer = async (item: User) => {
    editedUser.value = item;
    isDrawerOpen.value = true;

    // Pré-remplir avec les données de la liste pour une affichage immédiat
    userModel.value = {
        name: item.name,
        email: item.email,
        phone_number: item.phone_number || '',
        poste: item.poste || '',
        matricule: item.matricule || '',
        agence: item.agence || '',
        link_img: item.link_img || '',
        signature: item.signature || '',
        profil_id: item.profil?.id_profil || null,
        pole_id: item.pole?.id_pole || null
    };

    // Récupérer les détails complets et frais depuis l'API
    try {
        const response = await axiosInstance.get(`/users/${item.id_users}`);
        let data = response.data;
        // Gérer le cas où l'API retourne un tableau
        if (Array.isArray(data) && data.length > 0) {
            data = data[0];
        }
        userModel.value = {
            name: data.name,
            email: data.email,
            phone_number: data.phone_number || '',
            poste: data.poste || '',
            matricule: data.matricule || '',
            agence: data.agence || '',
            link_img: data.link_img || '',
            signature: data.signature || '',
            profil_id: data.profil_id || data.id_profil || (data.profil ? data.profil.id_profil : null),
            pole_id: data.pole_id || data.id_pole || (data.pole ? data.pole.id_pole : null)
        };
    } catch (error) {
        console.error("Impossible de charger les détails de l'utilisateur", error);
    }
};

const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const saveUser = async () => {
    const { valid } = await userForm.value!.validate();
    if (!valid) return;

    isFormLoading.value = true;
    try {
        let userId = editedUser.value?.id_users;

        if (editedUser.value) {
            await axiosInstance.put(`/users/${userId}`, userModel.value);
            toast.success("Utilisateur modifié avec succès");
        } else {
            const password = generatePassword();
            const payload = { ...userModel.value, password };
            const response = await axiosInstance.post('/users', payload);
            userId = response.data.id_users;
            
            // Afficher la modale avec les identifiants
            createdCredentials.value = {
                name: userModel.value.name,
                email: userModel.value.email,
                password: password
            };
            isCredentialsModalOpen.value = true;
            toast.success("Utilisateur ajouté avec succès");
        }

        // Assigner le pôle si sélectionné
        if (userId && userModel.value.pole_id) {
            await axiosInstance.put(`/users/${userId}/assign-pole`, { id_pole: userModel.value.pole_id });
        }

        isDrawerOpen.value = false;
        await fetchUsers();
    } catch (error) {
        toast.error("Erreur lors de l'enregistrement de l'utilisateur.");
    } finally {
        isFormLoading.value = false;
    }
};

const openDeleteDialog = (item: User) => {
    userToDelete.value = item;
    isDeleteDialogOpen.value = true;
};

const deleteUser = async () => {
    if (!userToDelete.value) return;
    try {
        await axiosInstance.delete(`/users/${userToDelete.value.id_users}`);
        toast.success('Utilisateur supprimé avec succès !');
        isDeleteDialogOpen.value = false;
        await fetchUsers();
    } catch (error) {
        toast.error("Erreur lors de la suppression de l'utilisateur.");
        console.error(error);
    }
};

const openViewDialog = async (item: User) => {
    isViewDialogOpen.value = true;
    viewUser.value = null;
    try {
        const response = await axiosInstance.get(`/users/${item.id_users}`);
        let data = response.data;
        if (Array.isArray(data) && data.length > 0) {
            data = data[0];
        }
        viewUser.value = data;
    } catch (error) {
        toast.error("Impossible de charger les détails de l'utilisateur.");
        isViewDialogOpen.value = false;
    }
};

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org'}${path}`;
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié !');
};

const printCredentials = () => {
    const content = `
        <div style="font-family: sans-serif; padding: 40px; border: 1px solid #ccc; border-radius: 8px; max-width: 500px; margin: 40px auto;">
            <h2 style="text-align: center; color: #333; margin-bottom: 30px;">Identifiants de connexion</h2>
            <div style="margin-bottom: 15px;"><strong>Nom :</strong> ${createdCredentials.value.name}</div>
            <div style="margin-bottom: 15px;"><strong>Email :</strong> ${createdCredentials.value.email}</div>
            <div style="margin-bottom: 15px;">
                <strong>Mot de passe :</strong> 
                <span style="font-family: monospace; background: #f5f5f5; padding: 5px 10px; border-radius: 4px; font-size: 1.2em; border: 1px solid #ddd;">${createdCredentials.value.password}</span>
            </div>
            <p style="font-size: 0.9em; color: #666; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">Veuillez conserver ces informations en lieu sûr.</p>
        </div>
    `;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
        printWindow.document.write(`<html><head><title>Identifiants - ${createdCredentials.value.name}</title></head><body>${content}</body></html>`);
        printWindow.document.close();
        printWindow.print();
    } else {
        toast.error("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les pop-ups.");
    }
};

onMounted(async () => {
    await Promise.all([fetchCurrentUser(), fetchProfils(), fetchPoles()]);
    await fetchUsers();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Gestion des Utilisateurs" style="padding: 2rem;">
                <template v-slot:action>
                    <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddDrawer">Ajouter un utilisateur</v-btn>
                </template>

                <v-table class="mt-5" :loading="loading" loading-text="Chargement des utilisateurs...">
                    <thead>
                        <tr>
                            <th class="text-left text-uppercase">Utilisateur</th>
                            <th class="text-left text-uppercase">Email</th>
                            <th class="text-left text-uppercase">Téléphone</th>
                            <th class="text-left text-uppercase">Agence</th>
                            <th class="text-left text-uppercase">Rôle</th>
                            <th class="text-left text-uppercase">Pôle</th>
                            <th class="text-right text-uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody v-if="!loading">
                        <tr v-for="item in users" :key="item.id_users">
                            <td>
                                <div class="d-flex align-center">
                                    <v-avatar size="40" color="primary" variant="tonal" class="mr-3">
                                        <span class="text-h6">{{ item.name.charAt(0).toUpperCase() }}</span>
                                    </v-avatar>
                                    <div>
                                        <h6 class="text-subtitle-1 font-weight-bold mb-0">{{ item.name }}</h6>
                                        <small class="text-medium-emphasis">{{ item.poste || 'Non défini' }}</small>
                                    </div>
                                </div>
                            </td>
                            <td>{{ item.email }}</td>
                            <td>{{ item.phone_number || '-' }}</td>
                            <td>{{ item.agence || '-' }}</td>
                            <td>
                                <v-chip color="primary" size="small" label variant="flat" v-if="item.profil">
                                    {{ item.profil.nom }}
                                </v-chip>
                                <span v-else class="text-medium-emphasis">-</span>
                            </td>
                            <td>
                                <v-chip color="secondary" size="small" label variant="flat" v-if="getPoleName(item)">
                                    {{ getPoleName(item) }}
                                </v-chip>
                                <span v-else class="text-medium-emphasis">-</span>
                            </td>
                            <td class="text-right">
                                <v-btn icon variant="text" color="info" size="small" @click="openViewDialog(item)">
                                    <EyeIcon size="20" />
                                </v-btn>
                                <v-btn icon variant="text" color="primary" size="small" @click="openEditDrawer(item)">
                                    <PencilIcon size="20" />
                                </v-btn>
                                <v-btn icon variant="text" color="error" size="small" @click="openDeleteDialog(item)">
                                    <TrashIcon size="20" />
                                </v-btn>
                            </td>
                        </tr>
                        <tr v-if="users.length === 0">
                            <td colspan="7" class="text-center text-medium-emphasis py-4">Aucun utilisateur trouvé.</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>

        <!-- Drawer pour ajouter/modifier un utilisateur -->
        <v-navigation-drawer v-model="isDrawerOpen" location="right" temporary width="400">
            <div class="pa-5">
                <div class="d-flex justify-space-between align-center mb-5">
                    <h3 class="text-h5">{{ drawerTitle }}</h3>
                    <v-btn icon="mdi-close" variant="text" @click="isDrawerOpen = false"></v-btn>
                </div>

                <v-form ref="userForm" @submit.prevent="saveUser">
                    <v-label class="font-weight-bold mb-1">Nom complet</v-label>
                    <v-text-field v-model="userModel.name" variant="outlined" color="primary" :rules="[v => !!v || 'Le nom est requis']"></v-text-field>

                    <v-label class="font-weight-bold mb-1">Email</v-label>
                    <v-text-field v-model="userModel.email" variant="outlined" color="primary" type="email" :rules="[v => !!v || 'L\'email est requis', v => /.+@.+\..+/.test(v) || 'Email invalide']"></v-text-field>

                    <v-label class="font-weight-bold mb-1">Téléphone</v-label>
                    <v-text-field v-model="userModel.phone_number" variant="outlined" color="primary"></v-text-field>

                    <v-label class="font-weight-bold mb-1">Poste</v-label>
                    <v-text-field v-model="userModel.poste" variant="outlined" color="primary"></v-text-field>

                    <v-label class="font-weight-bold mb-1">Profil (Rôle)</v-label>
                    <v-select v-model="userModel.profil_id" :items="profils" item-title="nom" item-value="id_profil" variant="outlined" color="primary" :rules="[v => !!v || 'Le profil est requis']"></v-select>

                    <v-label class="font-weight-bold mb-1">Pôle</v-label>
                    <v-select v-model="userModel.pole_id" :items="poles" item-title="nom" item-value="id_pole" variant="outlined" color="primary" clearable label="Sélectionner un pôle"></v-select>

                    <v-label class="font-weight-bold mb-1">Matricule</v-label>
                    <v-text-field v-model="userModel.matricule" variant="outlined" color="primary"></v-text-field>

                    <!-- <v-label class="font-weight-bold mb-1">Agence</v-label>
                    <v-text-field v-model="userModel.agence" variant="outlined" color="primary"></v-text-field>

                    <v-label class="font-weight-bold mb-1">Lien Image</v-label>
                    <v-text-field v-model="userModel.link_img" variant="outlined" color="primary"></v-text-field>

                    <v-label class="font-weight-bold mb-1">Signature</v-label>
                    <v-text-field v-model="userModel.signature" variant="outlined" color="primary"></v-text-field> -->

                    <v-btn color="primary" type="submit" block class="mt-4" :loading="isFormLoading">Enregistrer</v-btn>
                </v-form>
            </div>
        </v-navigation-drawer>

        <!-- Dialogue de confirmation de suppression -->
        <v-dialog v-model="isDeleteDialogOpen" max-width="500">
            <v-card>
                <v-card-title class="text-h5">Confirmer la suppression</v-card-title>
                <v-card-text>
                    Êtes-vous sûr de vouloir supprimer l'utilisateur "<strong>{{ userToDelete?.name }}</strong>" ? Cette action est irréversible.
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="isDeleteDialogOpen = false">Annuler</v-btn>
                    <v-btn color="error" @click="deleteUser">Supprimer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Dialogue de visualisation -->
        <v-dialog v-model="isViewDialogOpen" max-width="600">
            <v-card>
                <v-card-title class="d-flex justify-space-between align-center">
                    Détails de l'utilisateur
                    <v-btn icon="mdi-close" variant="text" @click="isViewDialogOpen = false"></v-btn>
                </v-card-title>
                <v-card-text v-if="viewUser">
                    <v-row>
                        <v-col cols="12" md="6"><strong>Nom:</strong> {{ viewUser.name }}</v-col>
                        <v-col cols="12" md="6"><strong>Email:</strong> {{ viewUser.email }}</v-col>
                        <v-col cols="12" md="6"><strong>Téléphone:</strong> {{ viewUser.phone_number || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Poste:</strong> {{ viewUser.poste || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Matricule:</strong> {{ viewUser.matricule || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Agence:</strong> {{ viewUser.agence || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Rôle:</strong> {{ viewUser.profil?.nom || '-' }}</v-col>
                        <v-col cols="12" md="6"><strong>Pôle:</strong> {{ getPoleName(viewUser) || '-' }}</v-col>
                        <v-col cols="12" v-if="viewUser.link_img">
                            <strong>Image:</strong> <br>
                            <v-img :src="getImageUrl(viewUser.link_img)" max-height="150" contain class="mt-2 bg-grey-lighten-4"></v-img>
                        </v-col>
                        <v-col cols="12" v-if="viewUser.signature">
                            <strong>Signature:</strong> <br>
                            <v-img :src="getImageUrl(viewUser.signature)" max-height="100" contain class="mt-2 bg-grey-lighten-4"></v-img>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-text v-else class="text-center">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- Dialogue des identifiants créés -->
        <v-dialog v-model="isCredentialsModalOpen" max-width="500" persistent>
            <v-card>
                <v-card-title class="text-h5 text-center py-4">
                    Identifiants créés
                </v-card-title>
                <v-card-text>
                    <v-alert type="info" variant="tonal" class="mb-4" density="compact">
                        Veuillez copier ou imprimer ces informations. Le mot de passe ne sera plus visible par la suite.
                    </v-alert>
                    
                    <v-list lines="two">
                        <v-list-item>
                            <template v-slot:prepend>
                                <v-icon icon="mdi-account" color="primary"></v-icon>
                            </template>
                            <v-list-item-title>Nom</v-list-item-title>
                            <v-list-item-subtitle class="text-body-1 text-high-emphasis opacity-100">
                                {{ createdCredentials.name }}
                            </v-list-item-subtitle>
                        </v-list-item>
                        
                        <v-list-item>
                            <template v-slot:prepend>
                                <v-icon icon="mdi-email" color="primary"></v-icon>
                            </template>
                            <v-list-item-title>Email</v-list-item-title>
                            <v-list-item-subtitle class="text-body-1 text-high-emphasis opacity-100">
                                {{ createdCredentials.email }}
                            </v-list-item-subtitle>
                            <template v-slot:append>
                                <v-btn icon="mdi-content-copy" variant="text" size="small" @click="copyToClipboard(createdCredentials.email)" title="Copier l'email"></v-btn>
                            </template>
                        </v-list-item>

                        <v-list-item>
                            <template v-slot:prepend>
                                <v-icon icon="mdi-lock" color="primary"></v-icon>
                            </template>
                            <v-list-item-title>Mot de passe</v-list-item-title>
                            <v-list-item-subtitle class="text-h6 font-weight-bold text-primary">
                                {{ createdCredentials.password }}
                            </v-list-item-subtitle>
                            <template v-slot:append>
                                <v-btn icon="mdi-content-copy" variant="text" size="small" @click="copyToClipboard(createdCredentials.password)" title="Copier le mot de passe"></v-btn>
                            </template>
                        </v-list-item>
                    </v-list>
                </v-card-text>
                <v-card-actions class="justify-center pb-4 px-4">
                    <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printCredentials">
                        Imprimer
                    </v-btn>
                    <v-btn color="primary" variant="elevated" @click="isCredentialsModalOpen = false">
                        Fermer
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>