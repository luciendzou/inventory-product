<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
const page = ref({ title: 'Gestion des Roles' });
const breadcrumbs = ref([
    {
        title: 'Utilisateurs',
        disabled: false,
        href: '#'
    },
    {
        title: 'Roles & Permissions',
        disabled: true,
        href: '#'
    }
]);

interface Profil {
    id_profil: string;
    nom: string;
    description: string | null;
}

const profils = ref<Profil[]>([]);
const loading = ref(true);

const fetchProfils = async () => {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/profils');
        profils.value = response.data;
    } catch (error) {
        toast.error('Impossible de charger les roles.');
        console.error(error);
    } finally {
        loading.value = false;
    }
};

const printPage = () => {
    if (!profils.value.length) {
        toast.warning('Aucun role a imprimer.');
        return;
    }

    const escapeHtml = (value: string) => {
        return (value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const rowsHtml = profils.value
        .map((item: Profil, idx: number) => `
            <tr>
                <td style="border:1px solid #d1d5db; padding:8px; width:60px;">${idx + 1}</td>
                <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(item.nom || '-')}</td>
                <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(item.description || '-')}</td>
            </tr>
        `)
        .join('');

    const content = `
        <div style="font-family: Arial, sans-serif; color:#111827; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
                <div>
                    <div style="font-weight:700; font-size:18px;">Liste des Roles (Profils)</div>
                    <div style="margin-top: 8px; font-size: 13px;"><strong>Total:</strong> ${profils.value.length}</div>
                </div>
                <div style="text-align:right; font-size:12px;">
                    <div>Imprime le: ${new Date().toLocaleString()}</div>
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f3f4f6;">
                        <th style="border:1px solid #d1d5db; padding:8px; width:60px;">#</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Nom du Role</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;

    const printWindow = window.open('', '', 'height=900,width=1200');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Liste des Roles</title></head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
};

onMounted(() => {
    fetchProfils();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Liste des Roles (Profils)" style="padding: 2rem;">
                <template v-slot:action>
                    <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                </template>

                <v-table class="mt-5" :loading="loading" loading-text="Chargement des roles...">
                    <thead>
                        <tr>
                            <th class="text-left text-uppercase">Nom du Role</th>
                            <th class="text-left text-uppercase">Description</th>
                        </tr>
                    </thead>
                    <tbody v-if="!loading">
                        <tr v-for="item in profils" :key="item.id_profil">
                            <td>
                                <div class="font-weight-bold">{{ item.nom }}</div>
                            </td>
                            <td>{{ item.description || '-' }}</td>
                        </tr>
                        <tr v-if="profils.length === 0">
                            <td colspan="3" class="text-center text-medium-emphasis py-4">Aucun role trouve.</td>
                        </tr>
                    </tbody>
                </v-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
