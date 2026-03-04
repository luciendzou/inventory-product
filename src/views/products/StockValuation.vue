<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
const page = ref({ title: 'Bilan et Valorisation des Stocks' });
const breadcrumbs = ref([
    { title: 'Rapports', disabled: false, href: '#' },
    { title: 'Valorisation', disabled: true, href: '#' }
]);

const loading = ref(true);
const stockData = ref<any[]>([]);
const search = ref('');
const selectedYear = ref(new Date().getFullYear());
const yearOptions = computed(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => current - i);
});
const currentUser = ref<any>(null);
const company = ref<any>(null);
const profils = ref<any[]>([]);
const printTypeOrder = ['informatique', 'bancaire', 'bureau', 'entretien', 'electrique', 'autres'];
const printTypeLabels: Record<string, string> = {
    informatique: 'Informatique',
    bancaire: 'Bancaire',
    bureau: 'Bureau',
    entretien: 'Entretien',
    electrique: 'Electrique',
    autres: 'Autres'
};

const headers = [
    { title: 'Produit', key: 'nom', align: 'start' as const, sortable: true },
    { title: 'Conditionnement', key: 'conditionnement', align: 'start' as const },
    { title: 'Qté Entrée', key: 'total_qte_entree', align: 'end' as const },
    { title: 'Valeur Entrée', key: 'total_valeur_entree', align: 'end' as const },
    { title: 'Qté Sortie', key: 'total_qte_sortie', align: 'end' as const },
    { title: 'Valeur Sortie (Est.)', key: 'total_valeur_sortie', align: 'end' as const },
    { title: 'Qté Restante', key: 'stock_actuel', align: 'end' as const },
    { title: 'Valeur Restante', key: 'valeur_stock', align: 'end' as const }
];

const fetchData = async () => {
    loading.value = true;
    try {
        const [productsRes, entriesRes, exitsRes, categoriesRes] = await Promise.all([
            axiosInstance.get('/products'),
            axiosInstance.get('/stock/entries'),
            axiosInstance.get('/stock/exits'),
            axiosInstance.get('/categories')
        ]);

        let products = productsRes.data;
        const entries = entriesRes.data;
        const exits = exitsRes.data;
        const categories = categoriesRes.data;

        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find((p) => p.id_profil === profileId);
        const role = userProfile?.nom?.toLowerCase();

        if (role && !['direction', 'controle', 'contrôle'].some((r) => role.includes(r))) {
            const userAgence = currentUser.value?.agence;
            const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

            if (userAgence || userPoleId) {
                products = products.filter((p: any) => {
                    const matchAgence = userAgence && p.agence === userAgence;
                    const matchPole = userPoleId && p.id_pole === userPoleId;
                    return matchAgence || matchPole;
                });
            }
        }

        stockData.value = products.map((product: any) => {
            const productEntries = entries.filter((e: any) => {
                if (e.id_product !== product.id_product) return false;
                const d = new Date(e.date_reception);
                return !isNaN(d.getTime()) && d.getFullYear() === selectedYear.value;
            });
            const productExits = exits.filter((s: any) => {
                if (s.id_product !== product.id_product) return false;
                const d = new Date(s.date_sortie);
                return !isNaN(d.getTime()) && d.getFullYear() === selectedYear.value;
            });

            const totalQteEntree = productEntries.reduce((sum: number, e: any) => sum + Number(e.quantite_entree), 0);
            const totalValeurEntree = productEntries.reduce((sum: number, e: any) => {
                const prixUnitaire = Number(e.prix_achat) || Number(product.prix) || 0;
                return sum + (Number(e.quantite_entree) * prixUnitaire);
            }, 0);

            const pump = totalQteEntree > 0 ? totalValeurEntree / totalQteEntree : (Number(product.prix) || 0);
            const totalQteSortie = productExits.reduce((sum: number, s: any) => sum + Number(s.quantite_sortie), 0);
            const totalValeurSortie = totalQteSortie * pump;
            const stockActuel = totalQteEntree - totalQteSortie;
            const valeurStock = stockActuel * pump;
            const typeProduit = categories.find((c: any) => c.id_categorie === product.id_categorie)?.type || 'Non defini';

            return {
                id: product.id_product,
                nom: product.nom,
                reference: product.reference,
                conditionnement: product.conditionnement || '',
                type_produit: typeProduit,
                total_qte_entree: totalQteEntree,
                total_valeur_entree: totalValeurEntree,
                total_qte_sortie: totalQteSortie,
                total_valeur_sortie: totalValeurSortie,
                stock_actuel: stockActuel,
                valeur_stock: valeurStock,
                pump
            };
        });
    } catch (error) {
        console.error(error);
        toast.error("Erreur lors du calcul de la valorisation.");
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value || 0);
};

const escapeHtml = (value: string) => {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org'}${path}`;
};

const getTypeBucket = (typeLabel: string) => {
    const t = (typeLabel || '').toLowerCase();
    if (t.includes('informat')) return 'informatique';
    if (t.includes('bancair')) return 'bancaire';
    if (t.includes('bureau')) return 'bureau';
    if (t.includes('entretien')) return 'entretien';
    if (t.includes('electri')) return 'electrique';
    return 'autres';
};

const fetchCurrentUser = async () => {
    try {
        const response = await axiosInstance.get('/user');
        currentUser.value = response.data;
    } catch (error) {
        console.error('Erreur chargement utilisateur', error);
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

const fetchCompany = async () => {
    if (!currentUser.value?.id_entreprise) return;
    try {
        const response = await axiosInstance.get(`/entreprises/${currentUser.value.id_entreprise}`);
        company.value = response.data;
    } catch (error) {
        console.error('Erreur chargement entreprise', error);
    }
};

const filteredStockData = computed(() => {
    const keyword = search.value.trim().toLowerCase();
    if (!keyword) return stockData.value;
    return stockData.value.filter((item: any) =>
        (item.nom || '').toLowerCase().includes(keyword) ||
        (item.reference || '').toLowerCase().includes(keyword)
    );
});

const exportToExcel = () => {
    const rows = filteredStockData.value;
    if (!rows.length) {
        toast.warning('Aucune donnée à exporter.');
        return;
    }

    const totalValeurEntree = rows.reduce((sum: number, item: any) => sum + (Number(item.total_valeur_entree) || 0), 0);
    const totalValeurSortie = rows.reduce((sum: number, item: any) => sum + (Number(item.total_valeur_sortie) || 0), 0);
    const totalValeurStock = rows.reduce((sum: number, item: any) => sum + (Number(item.valeur_stock) || 0), 0);

    const bodyRows = rows.map((item: any, index: number) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.nom || '-')}</td>
            <td>${escapeHtml(item.conditionnement || '-')}</td>
            <td style="text-align:right;">${item.total_qte_entree ?? 0}</td>
            <td style="text-align:right;">${item.total_valeur_entree ?? 0}</td>
            <td style="text-align:right;">${item.total_qte_sortie ?? 0}</td>
            <td style="text-align:right;">${item.total_valeur_sortie ?? 0}</td>
            <td style="text-align:right;">${item.stock_actuel ?? 0}</td>
            <td style="text-align:right;">${item.valeur_stock ?? 0}</td>
        </tr>
    `).join('');

    const tableHtml = `
        <html>
            <head><meta charset="UTF-8" /></head>
            <body>
                <table border="1" style="border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Produit</th>
                            <th>Conditionnement</th>
                            <th>Qté Entrée</th>
                            <th>Valeur Entrée</th>
                            <th>Qté Sortie</th>
                            <th>Valeur Sortie (Est.)</th>
                            <th>Qté Restante</th>
                            <th>Valeur Restante</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                        <tr>
                            <td colspan="4" style="text-align:right;"><strong>Total Valeur Entrée</strong></td>
                            <td style="text-align:right;"><strong>${totalValeurEntree}</strong></td>
                            <td style="text-align:right;"><strong>Total Valeur Sortie</strong></td>
                            <td style="text-align:right;"><strong>${totalValeurSortie}</strong></td>
                            <td style="text-align:right;"><strong>Total Valeur Stock</strong></td>
                            <td style="text-align:right;"><strong>${totalValeurStock}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `valorisation-stocks-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const printPage = () => {
    const rows = filteredStockData.value;
    if (!rows.length) {
        toast.warning('Aucune donnée à imprimer.');
        return;
    }

    const totalValeurEntree = rows.reduce((sum: number, item: any) => sum + (Number(item.total_valeur_entree) || 0), 0);
    const totalValeurSortie = rows.reduce((sum: number, item: any) => sum + (Number(item.total_valeur_sortie) || 0), 0);
    const totalValeurStock = rows.reduce((sum: number, item: any) => sum + (Number(item.valeur_stock) || 0), 0);

    const grouped: Record<string, any[]> = {
        informatique: [],
        bancaire: [],
        bureau: [],
        entretien: [],
        electrique: [],
        autres: []
    };
    rows.forEach((row: any) => {
        grouped[getTypeBucket(row.type_produit || '')].push(row);
    });

    let sectionHtml = '';
    printTypeOrder.forEach((key) => {
        const typeRows = grouped[key];
        if (!typeRows.length) return;

        const rowsHtml = typeRows.map((item: any, index: number) => `
            <tr>
                <td style="border:1px solid #d1d5db; padding:8px;">${index + 1}</td>
                <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(item.nom || '-')}</td>
                <td style="border:1px solid #d1d5db; padding:8px;">${escapeHtml(item.conditionnement || '-')}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${item.total_qte_entree ?? 0}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(item.total_valeur_entree || 0))}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${item.total_qte_sortie ?? 0}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(item.total_valeur_sortie || 0))}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${item.stock_actuel ?? 0}</td>
                <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(item.valeur_stock || 0))}</td>
            </tr>
        `).join('');

        sectionHtml += `
            <h3 style="margin: 20px 0 10px; color: #1f2937;">Type: ${printTypeLabels[key]}</h3>
            <table style="width:100%; border-collapse:collapse; margin-bottom: 18px;">
                <thead>
                    <tr style="background:#f3f4f6;">
                        <th style="border:1px solid #d1d5db; padding:8px; width:50px;">N°</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Produit</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Conditionnement</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Qté Entrée</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Valeur Entrée</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Qté Sortie</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Valeur Sortie</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Qté Restante</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Valeur Restante</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    });

    const logoUrl = company.value?.logo ? getImageUrl(company.value.logo) : '';
    const agency = currentUser.value?.agence || '-';
    const serviceResponsable = currentUser.value?.poste || 'Service de Gestion des Stocks';
    const normalizedAgency = (agency || '').toLowerCase();
    const isDirectionGenerale = normalizedAgency.includes('direction generale') || normalizedAgency.includes('direction générale');
    const signerTitle = isDirectionGenerale ? 'Le Directeur General' : `Chef agence de ${agency}`;

    const content = `
        <div style="font-family: Arial, sans-serif; color:#111827; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
                <div>
                    ${logoUrl ? `<img src="${logoUrl}" style="max-height:70px; max-width:180px;" />` : '<div style="font-weight:700; font-size:18px;">Inventory Pro</div>'}
                    <div style="margin-top: 8px; font-size: 13px;"><strong>Agence:</strong> ${escapeHtml(agency)}</div>
                </div>
                <div style="text-align:right; font-size:12px;">
                    <div><strong>Bilan et Valorisation des Stocks</strong></div>
                    <div>Imprimé le: ${new Date().toLocaleString()}</div>
                </div>
            </div>

            <div style="text-align:center; padding:10px 12px; font-size:20px; margin-bottom: 20px;">
                <strong><u>TABLEAU DE VALORISATION DES STOCKS</u></strong>
            </div>

            <div style="margin: 8px 0 18px; background:#eef6ff; border:1px solid #cfe3ff; padding:10px 12px; border-radius:6px; text-align:right;">
                <strong>Total valeur restante:</strong> ${escapeHtml(formatCurrency(totalValeurStock))}
            </div>

            ${sectionHtml}

            <table style="width:100%; border-collapse:collapse; margin-bottom: 16px;">
                <tfoot>
                    <tr style="background:#f9fafb; font-weight:700;">
                        <td colspan="4" style="border:1px solid #d1d5db; padding:8px; text-align:right;">Total Valeur Entree</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(totalValeurEntree))}</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">Total Valeur Sortie</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(totalValeurSortie))}</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">Total Valeur Stock</td>
                        <td style="border:1px solid #d1d5db; padding:8px; text-align:right;">${escapeHtml(formatCurrency(totalValeurStock))}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="display:flex; justify-content:space-between; margin-top:36px; padding-top:14px; border-top:1px solid #e5e7eb;">
                <div style="text-align:center; width:45%;">
                    <div style="font-size:13px; text-transform:uppercase; font-weight:600;">Service responsable</div>
                    <div style="margin-top:8px;">${escapeHtml(serviceResponsable)}</div>
                    <div style="margin-top:28px;">Signature: ____________________</div>
                </div>
                <div style="text-align:center; width:45%;">
                    <div style="font-size:13px; text-transform:uppercase; font-weight:600;">${escapeHtml(signerTitle)}</div>
                    <div style="margin-top:8px;">................................</div>
                    <div style="margin-top:28px;">Signature: ____________________</div>
                </div>
            </div>
        </div>
    `;

    const printWindow = window.open('', '', 'height=900,width=1200');
    if (!printWindow) return;

    printWindow.document.write(`
        <html>
            <head>
                <title>Valorisation Stocks - ${escapeHtml(agency)}</title>
            </head>
            <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 400);
};

onMounted(async () => {
    await Promise.all([fetchCurrentUser(), fetchProfils()]);
    await fetchCompany();
    await fetchData();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Tableau de bord des stocks" style="padding: 2rem;">
                <template v-slot:action>
                    <div class="d-flex ga-2">
                        <v-select
                            v-model="selectedYear"
                            :items="yearOptions"
                            label="Année"
                            variant="outlined"
                            density="compact"
                            hide-details
                            style="max-width: 120px;"
                            @update:model-value="fetchData"
                        />
                        <v-btn color="success" variant="outlined" prepend-icon="mdi-file-excel" @click="exportToExcel">Exporter Excel</v-btn>
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                    </div>
                </template>
                <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" label="Rechercher un produit..." variant="outlined" density="compact" hide-details class="mb-4"></v-text-field>

                <v-data-table :headers="headers" :items="stockData" :search="search" :loading="loading" density="comfortable" hover>
                    <template v-slot:item.total_valeur_entree="{ item }">
                        <span class="text-success font-weight-medium">{{ formatCurrency(item.total_valeur_entree) }}</span>
                    </template>
                    <template v-slot:item.total_valeur_sortie="{ item }">
                        <span class="text-warning">{{ formatCurrency(item.total_valeur_sortie) }}</span>
                    </template>
                    <template v-slot:item.stock_actuel="{ item }">
                        <v-chip :color="item.stock_actuel > 0 ? 'primary' : 'error'" size="small" variant="flat">
                            {{ item.stock_actuel }}
                        </v-chip>
                    </template>
                    <template v-slot:item.valeur_stock="{ item }">
                        <span class="font-weight-bold">{{ formatCurrency(item.valeur_stock) }}</span>
                    </template>
                </v-data-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>
