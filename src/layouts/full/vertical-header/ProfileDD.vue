<script setup lang="ts">
import { useRouter } from 'vue-router';
import { UserIcon, LockIcon } from 'vue-tabler-icons';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const router = useRouter();
const toast = useToast();

const logout = async () => {
    try {
        // Appel à l'API de déconnexion
        await axiosInstance.post('/logout');
        
        // Nettoyage du stockage local
        localStorage.removeItem('authToken');
        
        toast.success('Déconnexion réussie');
        router.push('/auth/login');
    } catch (error) {
        console.error("Erreur lors de la déconnexion", error);
        // Forcer la déconnexion locale même si l'API échoue (ex: token expiré)
        localStorage.removeItem('authToken');
        router.push('/auth/login');
    }
};
</script>

<template>
    <!-- Menu Profil avec bouton de déconnexion -->
    <v-menu :close-on-content-click="false">
        <template v-slot:activator="{ props }">
            <v-btn class="profileBtn custom-hover-primary" variant="text" v-bind="props" icon>
                <v-avatar size="35" color="primary" variant="tonal">
                    <UserIcon size="20" />
                </v-avatar>
            </v-btn>
        </template>
        <v-sheet rounded="md" width="200" elevation="10" class="mt-2">
            <v-list class="py-0" lines="one" density="compact">
                <v-list-item value="item1" color="primary" to="/users/profile">
                    <template v-slot:prepend>
                        <UserIcon stroke-width="1.5" size="20" />
                    </template>
                    <v-list-item-title class="pl-4 text-body-1">Mon Profil</v-list-item-title>
                </v-list-item>
                <v-list-item value="item2" color="primary" to="/users/change-password">
                    <template v-slot:prepend>
                        <LockIcon stroke-width="1.5" size="20" />
                    </template>
                    <v-list-item-title class="pl-4 text-body-1">Modifier le mot de passe</v-list-item-title>
                </v-list-item>
            </v-list>
            <div class="pt-4 pb-4 px-5 text-center">
                <v-btn color="primary" variant="outlined" block @click="logout">Se déconnecter</v-btn>
            </div>
        </v-sheet>
    </v-menu>
</template>
