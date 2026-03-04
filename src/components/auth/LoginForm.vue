<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';
import { startRealtimeNotifications } from '@/utils/realtimeNotifications';

const checkbox = ref(true);
const valid = ref(true);
const loading = ref(false);
const login = ref('');
const password = ref('');
const showPassword = ref(false);
const errorMessage = ref('');
const router = useRouter();
const toast = useToast();

const loginRules = ref([(v: string) => !!v || 'Ce champ est requis']);
const passwordRules = ref([(v: string) => !!v || 'Ce champ est requis']);

async function validate() {
    if (!login.value || !password.value) return;
    loading.value = true;
    errorMessage.value = '';

    try {
        const loginResponse = await axiosInstance.post('/login', {
            login: login.value,
            password: password.value
        });

        const { access_token, user } = loginResponse.data;
        localStorage.setItem('authToken', access_token);
        localStorage.setItem('authUserId', user.id_users);
        startRealtimeNotifications(user.id_users, access_token);

        // Vérifier si le forfait de l'entreprise est configuré
        try {
            await axiosInstance.get(`/config-entreprises/by-entreprise/${user.id_entreprise}`);
            router.push('/');
        } catch (configError: any) {
            if (configError.response && configError.response.status === 404) {
                toast.info("Veuillez sélectionner un forfait pour votre entreprise.");
                router.push(`/auth/plans/${user.id_entreprise}`);
            } else {
                // Gérer d'autres erreurs potentielles lors de la vérification du forfait
                toast.error("Impossible de vérifier la configuration de votre entreprise.");
                throw configError;
            }
        }
    } catch (error: any) {
        errorMessage.value = error.response?.data?.message || 'Email ou mot de passe incorrect.';
        console.error('Login process failed:', error);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <v-form @submit.prevent="validate">
        <v-alert v-if="errorMessage" type="error" density="compact" class="mb-4">{{ errorMessage }}</v-alert>
        <v-row class="d-flex mb-3">
            <v-col cols="12">
                <v-label class="font-weight-bold mb-1">Email / Nom d'utilisateur</v-label>
                <v-text-field v-model="login" :rules="loginRules" variant="outlined" color="primary"></v-text-field>
            </v-col>
            <v-col cols="12">
                <v-label class="font-weight-bold mb-1">Mot de passe</v-label>
                <v-text-field
                    v-model="password"
                    :rules="passwordRules"
                    variant="outlined"
                    :type="showPassword ? 'text' : 'password'"
                    :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    color="primary"
                    @click:append-inner="showPassword = !showPassword"
                ></v-text-field>
            </v-col>
            <v-col cols="12" class="pt-0">
                <div class="d-flex flex-wrap align-center ml-n2">
                    <v-checkbox v-model="checkbox" color="primary" hide-details>
                        <template v-slot:label class="text-body-1">Se souvenir de moi</template>
                    </v-checkbox>
                    <div class="ml-sm-auto">
                        <RouterLink to="/" class="text-primary text-decoration-none text-body-1 opacity-1 font-weight-medium">Mot de passe oublié ?</RouterLink>
                    </div>
                </div>
            </v-col>
            <v-col cols="12" class="pt-0">
                <v-btn type="submit" color="primary" size="large" block flat :loading="loading">Se connecter</v-btn>
            </v-col>
        </v-row>
    </v-form>
</template>
