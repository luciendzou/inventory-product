<script setup lang="ts">
import { ref } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
const page = ref({ title: 'Modifier le mot de passe' });
const breadcrumbs = ref([
    { title: 'Utilisateurs', disabled: false, href: '#' },
    { title: 'Modifier le mot de passe', disabled: true, href: '#' }
]);

const loading = ref(false);
const passwordForm = ref<HTMLFormElement | null>(null);
const form = ref({
    current_password: '',
    password: '',
    password_confirmation: ''
});

const minLenRule = (v: string) => (v || '').length >= 8 || '8 caracteres minimum';
const requiredRule = (v: string) => !!v || 'Requis';
const confirmRule = (v: string) => v === form.value.password || 'La confirmation ne correspond pas';

const updatePassword = async () => {
    if (!passwordForm.value) return;
    const { valid } = await passwordForm.value.validate();
    if (!valid) return;

    loading.value = true;
    try {
        const userRes = await axiosInstance.get('/user');
        const userId = userRes.data?.id_users;

        if (!userId) {
            toast.error('Utilisateur introuvable.');
            return;
        }

        await axiosInstance.post(`/users/${userId}/change-password`, {
            current_password: form.value.current_password,
            password: form.value.password,
            password_confirmation: form.value.password_confirmation
        });

        toast.success('Mot de passe modifie avec succes.');
        form.value = {
            current_password: '',
            password: '',
            password_confirmation: ''
        };
    } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Impossible de modifier le mot de passe.');
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs" />
    <v-row>
        <v-col cols="12" md="8" lg="6">
            <UiParentCard title="Securite du compte" style="padding: 2rem;">
                <v-form ref="passwordForm" @submit.prevent="updatePassword">
                    <v-label class="font-weight-medium mb-2">Mot de passe actuel</v-label>
                    <v-text-field
                        v-model="form.current_password"
                        type="password"
                        variant="outlined"
                        autocomplete="current-password"
                        :rules="[requiredRule]"
                    />

                    <v-label class="font-weight-medium mb-2">Nouveau mot de passe</v-label>
                    <v-text-field
                        v-model="form.password"
                        type="password"
                        variant="outlined"
                        autocomplete="new-password"
                        :rules="[requiredRule, minLenRule]"
                    />

                    <v-label class="font-weight-medium mb-2">Confirmer le nouveau mot de passe</v-label>
                    <v-text-field
                        v-model="form.password_confirmation"
                        type="password"
                        variant="outlined"
                        autocomplete="new-password"
                        :rules="[requiredRule, confirmRule]"
                    />

                    <div class="d-flex justify-end mt-2">
                        <v-btn color="primary" type="submit" :loading="loading" prepend-icon="mdi-lock-reset">
                            Mettre a jour
                        </v-btn>
                    </div>
                </v-form>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
