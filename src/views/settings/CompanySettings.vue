<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useTheme } from 'vuetify';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';
import { useI18n } from 'vue-i18n';

const toast = useToast();
const theme = useTheme();
const { locale } = useI18n();

const THEME_KEY = 'appTheme';
const LOCALE_KEY = 'appLocale';
const STOCK_ROLLOVER_ENDPOINT = import.meta.env.VITE_STOCK_ROLLOVER_ENDPOINT || '/stock/year-rollover';

const page = ref({ title: "Paramètres de l'entreprise" });
const breadcrumbs = ref([
    { title: 'Paramètres', disabled: false, href: '#' },
    { title: 'Entreprise', disabled: true, href: '#' }
]);

const loading = ref(false);
const rollingStock = ref(false);
const rolloverDone = ref(false);
const savingPreferences = ref(false);
const today = ref(new Date());

const companyModel = ref({
    id_entreprise: '',
    company_name: '',
    tax_number: '',
    address: '',
    company_email: '',
    logo: '',
    manager_name: '',
    manager_email: '',
    manager_phone: '',
    manager_nui: ''
});

const logoFile = ref<any>(null);
const currentUser = ref<any>(null);
const profils = ref<any[]>([]);

const selectedTheme = ref(localStorage.getItem(THEME_KEY) || (theme.global.name.value as string) || 'BlueTheme');
const selectedLocale = ref(localStorage.getItem(LOCALE_KEY) || locale.value || 'fr');

const normalizeText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const currentRoleName = computed(() => {
    if (!currentUser.value) return '';

    if (currentUser.value.profil?.nom) {
        return String(currentUser.value.profil.nom).toLowerCase();
    }

    const profileId =
        currentUser.value.id_profil ||
        currentUser.value.profil_id ||
        currentUser.value.profil?.id_profil ||
        null;

    if (!profileId) return '';

    const profile = profils.value.find((p: any) => p.id_profil === profileId);
    return (profile?.nom || '').toLowerCase();
});

const normalizedAgency = computed(() => normalizeText(currentUser.value?.agence || ''));
const normalizedRole = computed(() => normalizeText(currentRoleName.value || ''));

const isAdmin = computed(() => normalizedRole.value.includes('admin'));
const isDirectionRole = computed(() => normalizedRole.value.includes('direction'));
const isControle = computed(() => normalizedRole.value.includes('controle'));
const isAgence = computed(() => normalizedRole.value.includes('agence'));
const isAgent = computed(() => normalizedRole.value.includes('agent'));
const isDirectionGeneraleAgency = computed(
    () => normalizedAgency.value.includes('direction generale')
);
const isAdminDirectionGenerale = computed(() => isAdmin.value && isDirectionGeneraleAgency.value);

const canEditCompanySettings = computed(() => isDirectionRole.value || isAdminDirectionGenerale.value);
const canShowStockRollover = computed(() => !isAgent.value && (isAdmin.value || isDirectionRole.value || isControle.value || isAgence.value));
const canCustomizeAppearance = computed(
    () => (isAdmin.value && isAdminDirectionGenerale.value) || isControle.value || isAgent.value
);

const isStockRolloverWindowOpen = computed(() => today.value.getMonth() === 0 && today.value.getDate() <= 30);
const targetYear = computed(() => today.value.getFullYear());
const sourceYear = computed(() => targetYear.value - 1);
const rolloverStorageKey = computed(() => {
    const scope = currentUser.value?.id_entreprise || 'default';
    return `stock-year-rollover:${scope}:${targetYear.value}`;
});
const canRunStockRollover = computed(() => isStockRolloverWindowOpen.value && !rolloverDone.value);

const themeOptions = [
    { title: 'Clair', value: 'BlueTheme' },
    { title: 'Sombre', value: 'dark' }
];

const localeOptions = [
    { title: 'Français', value: 'fr' },
    { title: 'English', value: 'en' }
];

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org'}${path}`;
};

const applyTheme = (themeName: string) => {
    theme.global.name.value = themeName;
    localStorage.setItem(THEME_KEY, themeName);
    window.dispatchEvent(new Event('app-theme-changed'));
};

const applyLocale = (localeValue: string) => {
    locale.value = localeValue;
    localStorage.setItem(LOCALE_KEY, localeValue);
    window.dispatchEvent(new Event('app-locale-changed'));
};

const saveAppearancePreferences = async () => {
    savingPreferences.value = true;
    try {
        applyTheme(selectedTheme.value);
        applyLocale(selectedLocale.value);
        toast.success('Préférences mises à jour.');
    } catch (error) {
        console.error(error);
        toast.error('Impossible de sauvegarder les préférences.');
    } finally {
        savingPreferences.value = false;
    }
};

const fetchCompanySettings = async () => {
    loading.value = true;
    try {
        const userRes = await axiosInstance.get('/user');
        const user = userRes.data;
        currentUser.value = user;

        if (user.id_entreprise) {
            const companyRes = await axiosInstance.get(`/entreprises/${user.id_entreprise}`);
            const data = companyRes.data;

            companyModel.value = {
                id_entreprise: data.id_entreprise,
                company_name: data.company_name,
                tax_number: data.tax_number,
                address: data.address,
                company_email: data.company_email,
                logo: data.logo,
                manager_name: data.manager_name,
                manager_email: data.manager_email,
                manager_phone: data.manager_phone,
                manager_nui: data.manager_nui
            };
        }
    } catch (error) {
        console.error(error);
        toast.error("Impossible de charger les informations de l'entreprise.");
    } finally {
        loading.value = false;
    }
};

const fetchProfils = async () => {
    try {
        const response = await axiosInstance.get('/profils');
        profils.value = response.data;
    } catch (error) {
        console.error('Erreur chargement profils', error);
    }
};

const saveSettings = async () => {
    if (!canEditCompanySettings.value) {
        toast.error("Vous n'etes pas autorise a modifier ces informations.");
        return;
    }

    loading.value = true;
    try {
        const file = Array.isArray(logoFile.value) ? logoFile.value[0] : logoFile.value;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            const response = await axiosInstance.post('/users/upload-media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            companyModel.value.logo = response.data.path;
        }

        await axiosInstance.put(`/entreprises/${companyModel.value.id_entreprise}`, companyModel.value);
        toast.success('Paramètres enregistrés avec succès !');
        await fetchCompanySettings();
        logoFile.value = null;
    } catch (error) {
        console.error(error);
        toast.error('Erreur lors de la sauvegarde des paramètres.');
    } finally {
        loading.value = false;
    }
};

const rolloverStockToNewYear = async () => {
    if (!canRunStockRollover.value) {
        toast.error("La bascule n'est autorisée que du 1er au 30 janvier.");
        return;
    }

    rollingStock.value = true;
    try {
        await axiosInstance.post(STOCK_ROLLOVER_ENDPOINT, {
            year: targetYear.value
        });
        rolloverDone.value = true;
        localStorage.setItem(rolloverStorageKey.value, '1');
        toast.success(`Bascule de stock ${sourceYear.value} -> ${targetYear.value} effectuée.`);
    } catch (error: any) {
        console.error(error);
        if (error?.response?.status === 409) {
            rolloverDone.value = true;
            localStorage.setItem(rolloverStorageKey.value, '1');
            toast.info(error?.response?.data?.message || 'La bascule a deja ete effectuee.');
        } else {
            toast.error(error?.response?.data?.message || 'Erreur pendant la bascule de stock.');
        }
    } finally {
        rollingStock.value = false;
    }
};

const printPage = () => {
    window.print();
};

onMounted(async () => {
    applyTheme(selectedTheme.value);
    applyLocale(selectedLocale.value);
    await fetchProfils();
    await fetchCompanySettings();
    rolloverDone.value = localStorage.getItem(rolloverStorageKey.value) === '1';
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <template v-if="canEditCompanySettings">
            <v-col cols="12" md="4">
                <UiParentCard title="Logo de l'entreprise" style="padding: 2rem;">
                    <div class="d-flex flex-column align-center pt-4">
                        <div class="mb-4 border border-dashed pa-4 rounded w-100 d-flex justify-center align-center bg-grey-lighten-5" style="height: 150px;">
                            <v-img v-if="companyModel.logo" :src="getImageUrl(companyModel.logo)" max-height="120" contain></v-img>
                            <div v-else class="text-medium-emphasis font-italic">Aucun logo</div>
                        </div>
                        <v-file-input v-model="logoFile" label="Changer le logo" variant="outlined" density="compact" prepend-icon="mdi-camera" accept="image/*" class="w-100" hide-details :disabled="!canEditCompanySettings"></v-file-input>
                    </div>
                </UiParentCard>
            </v-col>

            <v-col cols="12" md="8">
                <UiParentCard title="Informations générales" style="padding: 2rem;">
                    <template v-slot:action>
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                    </template>
                    <v-form @submit.prevent="saveSettings">
                        <h6 class="text-subtitle-1 font-weight-bold mb-4">Détails de l'entreprise</h6>
                        <v-row>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Nom de l'entreprise</v-label><v-text-field v-model="companyModel.company_name" variant="outlined" color="primary" density="comfortable" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Email de contact</v-label><v-text-field v-model="companyModel.company_email" variant="outlined" color="primary" density="comfortable" type="email" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Numéro de contribuable</v-label><v-text-field v-model="companyModel.tax_number" variant="outlined" color="primary" density="comfortable" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Adresse</v-label><v-text-field v-model="companyModel.address" variant="outlined" color="primary" density="comfortable" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                        </v-row>

                        <v-divider class="my-6"></v-divider>

                        <h6 class="text-subtitle-1 font-weight-bold mb-4">Responsable</h6>
                        <v-row>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Nom du responsable</v-label><v-text-field v-model="companyModel.manager_name" variant="outlined" color="primary" density="comfortable" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Email du responsable</v-label><v-text-field v-model="companyModel.manager_email" variant="outlined" color="primary" density="comfortable" type="email" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Téléphone</v-label><v-text-field v-model="companyModel.manager_phone" variant="outlined" color="primary" density="comfortable" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                            <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">NUI</v-label><v-text-field v-model="companyModel.manager_nui" variant="outlined" color="primary" density="comfortable" :readonly="!canEditCompanySettings"></v-text-field></v-col>
                        </v-row>

                        <div class="d-flex justify-end mt-6" v-if="canEditCompanySettings">
                            <v-btn color="primary" type="submit" :loading="loading" size="large" flat>Enregistrer les modifications</v-btn>
                        </div>
                    </v-form>
                </UiParentCard>
            </v-col>
        </template>

        <v-col cols="12" v-if="canShowStockRollover && isStockRolloverWindowOpen && !rolloverDone">
            <UiParentCard title="Bascule annuelle du stock" style="padding: 2rem;">
                <v-alert type="info" variant="tonal" class="mb-4">
                    Cette opération permet de basculer le stock de l'année {{ sourceYear }} vers {{ targetYear }}.
                    Elle est autorisée uniquement du 1er au 30 janvier.
                </v-alert>

                <div class="d-flex flex-wrap align-center ga-3">
                    <v-chip color="primary" variant="outlined">Année source: {{ sourceYear }}</v-chip>
                    <v-chip color="secondary" variant="outlined">Nouvelle année: {{ targetYear }}</v-chip>
                </div>

                <div class="d-flex justify-end mt-6">
                    <v-btn color="primary" :loading="rollingStock" :disabled="!canRunStockRollover" prepend-icon="mdi-swap-horizontal-bold" @click="rolloverStockToNewYear">
                        Basculer le stock vers {{ targetYear }}
                    </v-btn>
                </div>
            </UiParentCard>
        </v-col>

        <v-col cols="12" md="6" v-if="canCustomizeAppearance">
            <UiParentCard title="Personnalisation (thème et langue)" style="padding: 2rem;">
                <v-row>
                    <v-col cols="12" md="6">
                        <v-label class="font-weight-medium mb-2">Thème</v-label>
                        <v-select v-model="selectedTheme" :items="themeOptions" item-title="title" item-value="value" variant="outlined" density="comfortable"></v-select>
                    </v-col>
                    <v-col cols="12" md="6">
                        <v-label class="font-weight-medium mb-2">Langue</v-label>
                        <v-select v-model="selectedLocale" :items="localeOptions" item-title="title" item-value="value" variant="outlined" density="comfortable"></v-select>
                    </v-col>
                </v-row>
                <div class="d-flex justify-end mt-2">
                    <v-btn color="primary" :loading="savingPreferences" prepend-icon="mdi-content-save" @click="saveAppearancePreferences">
                        Enregistrer mes préférences
                    </v-btn>
                </div>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
