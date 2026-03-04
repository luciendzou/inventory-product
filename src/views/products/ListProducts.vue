<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { PencilIcon, TrashIcon, PlusIcon } from 'vue-tabler-icons';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
const router = useRouter();
// Breadcrumb
const page = ref({ title: 'Liste des Produits' });
const breadcrumbs = ref([
    {
        title: 'Produits',
        disabled: false,
        href: '#'
    },
    {
        title: 'Liste des produits',
        disabled: true,
        href: '#'
    }
]);

// --- Formulaire d'ajout/modification ---
const isDrawerOpen = ref(false);
const productForm = ref<HTMLFormElement | null>(null);
const isFormLoading = ref(false);
const editedProduct = ref<Product | null>(null);

// --- Prévisualisation ---
const isPreviewOpen = ref(false);
const previewProduct = ref<Product | null>(null);

// Modèle pour l'entrée de produits par lot
const batchEntryModel = ref({
    id_fournisseur: null as string | null,
    date_reception: new Date().toISOString().substr(0, 10),
    lignes: [{
        nom: '',
        description: '',
        reference: '',
        conditionnement: '',
        id_product: null as string | null,
        quantite_stock: 1,
        id: Symbol(),
        brandSearch: '',
        quantite_min_alerte: 0,
        prix: 0.0,
        id_categorie: null as string | null,
        id_marque: null as string | null,
        refSuffix: Math.floor(1000 + Math.random() * 9000).toString()
    }]
});

// --- Modales pour la création de marque/fournisseur ---
const isBrandModalOpen = ref(false);
const newBrandName = ref('');
const isSupplierModalOpen = ref(false);
const newSupplier = ref({
    nom: '',
    contact_nom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    pays: '',
    notes: ''
});

// Pour gérer la saisie dans les autocompletes
const supplierSearch = ref('');
const csvFile = ref<File | null>(null);

// --- Suppression ---
const isDeleteDialogOpen = ref(false);
const productToDelete = ref<Product | null>(null);

// Données pour les listes déroulantes
const categories = ref<{ id_categorie: string, name_cat: string, type: string}[]>([]);
const brands = ref<{ id_marque: string, nom: string }[]>([]);
const suppliers = ref<{ id_fournisseur: string, nom: string }[]>([]);

const drawerTitle = computed(() => {
    return editedProduct.value ? 'Modifier le produit' : 'Ajouter un produit';
});

const categoryOptions = computed(() => {
    return categories.value.map((c) => ({
        ...c,
        category_label: `${c.name_cat}-${c.type}`
    }));
});

// Options pour les champs de sélection
const fetchSelectOptions = async () => {
    try {
        const [catRes, brandRes, supRes] = await Promise.all([
            axiosInstance.get('/categories'),
            axiosInstance.get('/brands'), // Assumant que cet endpoint existe
            axiosInstance.get('/fournisseurs') // Assumant que cet endpoint existe
        ]);
        categories.value = catRes.data;
        brands.value = brandRes.data;
        suppliers.value = supRes.data;
    } catch (error) {
        toast.error("Impossible de charger les options du formulaire.");
    }
};

// Interface pour un produit, basée sur votre modèle
interface Product {
    id_product: string;
    nom: string;
    description: string;
    reference: string;
    conditionnement?: string | null;
    quantite_stock: number;
    quantite_min_alerte: number;
    prix: number;
    agence: string | null;
    id_pole?: string | null;
    id_categorie: string;
    id_marque: string | null;
    id_fournisseur: string | null;
}

const products = ref<Product[]>([]);
const loading = ref(true);
const currentUser = ref<any>(null);
const company = ref<any>(null);
const profils = ref<any[]>([]);
const currentPage = ref(1);
const itemsPerPage = ref(10);
const search = ref('');
const productSelectOptions = computed(() => {
    return products.value.map((p) => ({
        ...p,
        product_label: `${p.nom} (${p.reference || 'Sans référence'})`
    }));
});

const filteredProducts = computed(() => {
    const keyword = search.value.trim().toLowerCase();
    if (!keyword) return products.value;

    return products.value.filter((item) => {
        const categoryName = getCategoryName(item.id_categorie).toLowerCase();
        return (
            (item.nom || '').toLowerCase().includes(keyword) ||
            (item.reference || '').toLowerCase().includes(keyword) ||
            (item.agence || '').toLowerCase().includes(keyword) ||
            categoryName.includes(keyword)
        );
    });
});

const totalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredProducts.value.length / itemsPerPage.value));
});

const paginatedProducts = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    return filteredProducts.value.slice(start, start + itemsPerPage.value);
});

const getRowNumber = (index: number) => {
    return (currentPage.value - 1) * itemsPerPage.value + index + 1;
};

// Récupérer les produits depuis l'APIPè´le
const fetchProducts = async () => {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/products'); // Assumant que cet endpoint existe
        let data = response.data;

        // Filtrage par agence
        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find(p => p.id_profil === profileId);
        const role = userProfile?.nom?.toLowerCase();

        if (role && !['direction', 'contrè´le', 'controle'].some(r => role.includes(r))) {
            const userAgence = currentUser.value?.agence;
            const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

            if (userAgence || userPoleId) {
                data = data.filter((p: Product) => {
                    const matchAgence = userAgence && p.agence === userAgence;
                    const matchPole = userPoleId && p.id_pole === userPoleId;
                    return matchAgence || matchPole;
                });
            }
        }
        products.value = data;
        currentPage.value = 1;
    } catch (error) {
        toast.error("Impossible de charger les produits.");
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

const fetchCompany = async () => {
    if (!currentUser.value?.id_entreprise) return;
    try {
        const response = await axiosInstance.get(`/entreprises/${currentUser.value.id_entreprise}`);
        company.value = response.data;
    } catch (error) {
        console.error("Erreur chargement entreprise", error);
    }
};

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `https://api.inventory.cremin-cam.org${path}`;
};

const escapeHtml = (value: string) => {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const getCategoryById = (categoryId: string) => {
    return categories.value.find((c) => c.id_categorie === categoryId) || null;
};

const getCategoryTypeByProduct = (product: Product) => {
    return getCategoryById(product.id_categorie)?.type || 'Non défini';
};

const getTypeBucket = (typeLabel: string) => {
    const t = (typeLabel || '').toLowerCase();
    if (t.includes('informat')) return 'informatique';
    if (t.includes('bancair')) return 'bancaire';
    if (t.includes('bureau')) return 'bureau';
    if (t.includes('entretien')) return 'entretien';
    if (t.includes('electri') || t.includes('électri')) return 'electrique';
    return 'autres';
};

const printPage = () => {
    if (!products.value.length) {
        toast.warning("Aucun produit à imprimer.");
        return;
    }

    const order = ['informatique', 'bancaire', 'bureau', 'entretien', 'electrique', 'autres'];
    const labels: Record<string, string> = {
        informatique: 'Informatique',
        bancaire: 'Bancaire',
        bureau: 'Bureau',
        entretien: 'Entretien',
        electrique: 'Electrique',
        autres: 'Autres'
    };

    const grouped: Record<string, Product[]> = {
        informatique: [],
        bancaire: [],
        bureau: [],
        entretien: [],
        electrique: [],
        autres: []
    };

    products.value.forEach((p) => {
        const bucket = getTypeBucket(getCategoryTypeByProduct(p));
        grouped[bucket].push(p);
    });

    const totalGeneralValeur = products.value.reduce((sum, item) => {
        return sum + (Number(item.prix) || 0) * (Number(item.quantite_stock) || 0);
    }, 0);

    let sectionHtml = '';
    order.forEach((key) => {
        const rows = grouped[key];
        if (!rows.length) return;

        const rowsHtml = rows
            .map((item, idx) => {
                const totalValue = (Number(item.prix) || 0) * (Number(item.quantite_stock) || 0);
                return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${escapeHtml(item.nom || '')}</td>
                        <td>${escapeHtml(item.conditionnement || '-')}</td>
                        <td style="text-align:right;">${escapeHtml(formatCurrency(item.prix || 0))}</td>
                        <td style="text-align:center;">${item.quantite_stock ?? 0}</td>
                        <td style="text-align:right;">${escapeHtml(formatCurrency(totalValue))}</td>
                    </tr>
                `;
            })
            .join('');

        sectionHtml += `
            <h3 style="margin: 20px 0 10px; color: #1f2937;">Type: ${labels[key]}</h3>
            <table style="width:100%; border-collapse:collapse; margin-bottom: 16px;">
                <thead>
                    <tr style="background:#f3f4f6;">
                        <th style="border:1px solid #d1d5db; padding:8px; width:50px;">N°</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Produit</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:left;">Conditionnement</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Prix</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:center;">Stock</th>
                        <th style="border:1px solid #d1d5db; padding:8px; text-align:right;">Valeur totale</th>
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
    const normalizedAgency = (agency || '').toLowerCase();
    const isDirectionGenerale = normalizedAgency.includes('direction générale') || normalizedAgency.includes('direction generale');
    const signerTitle = isDirectionGenerale ? 'Le Directeur General' : `Chef de l'${agency}`;
    const signerName = isDirectionGenerale ? (company.value?.manager_name || '................................') : '................................';
    const serviceResponsable = currentUser.value?.poste || '................................';

    const content = `
        <div style="font-family: Arial, sans-serif; color:#111827; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
                <div>
                    ${logoUrl ? `<img src="${logoUrl}" style="max-height:70px; max-width:180px;" />` : '<div style="font-weight:700; font-size:18px;">Inventory Pro</div>'}
                    <div style="margin-top: 8px; font-size: 13px;"><strong>Agence:</strong> ${escapeHtml(agency)}</div>
                </div>
                <div style="text-align:right; font-size:12px;">
                    <div><strong>Liste des Produits par Type</strong></div>
                    <div>Imprimé le: ${new Date().toLocaleString()}</div>
                </div>  
            </div>

            <div style="text-align:center; padding:10px 12px; font-size:24px; margin-bottom: 2rem; margin-top: 4rem;">
                <strong><u>LISTE DES PRODUITS PAR TYPE</u></strong>
            </div>

            <div style="margin: 8px 0 18px; background:#eef6ff; border:1px solid #cfe3ff; padding:10px 12px; border-radius:6px; text-align:right;">
                <strong>Total général des valeurs:</strong> ${escapeHtml(formatCurrency(totalGeneralValeur))}
            </div>

            ${sectionHtml || '<p>Aucun produit disponible.</p>'}

            <div style="margin: 10px 0 18px; background:#eef6ff; border:1px solid #cfe3ff; padding:10px 12px; border-radius:6px; text-align:right;">
                <strong>Total général des valeurs:</strong> ${escapeHtml(formatCurrency(totalGeneralValeur))}
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:36px; padding-top:14px; border-top:1px solid #e5e7eb;">
                <div style="text-align:center; width:45%;">
                    <div style="font-size:13px; text-transform:uppercase; font-weight:600;">Service responsable</div>
                    <div style="margin-top:8px;">${escapeHtml(serviceResponsable)}</div>
                    <div style="margin-top:28px;">Signature: ____________________</div>
                </div>
                <div style="text-align:center; width:45%;">
                    <div style="font-size:13px; text-transform:uppercase; font-weight:600;">${escapeHtml(signerTitle)}</div>
                    <div style="margin-top:8px;">${escapeHtml(signerName)}</div>
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
                <title>Liste Produits - ${escapeHtml(agency)}</title>
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
    await Promise.all([fetchCurrentUser(), fetchProfils(), fetchSelectOptions()]);
    await fetchCompany();
    await fetchProducts();
});

const getCategoryName = (categoryId: string) => {
    const category = categories.value.find(c => c.id_categorie === categoryId);
    return category ? category.name_cat : 'Inconnue';
};

const openAddDrawer = async () => {
    try {
        const response = await axiosInstance.get('/user');
        const user = response.data;
        const requiredFields = ['matricule', 'agence', 'poste', 'link_img', 'signature', 'phone_number'];
        
        if (!requiredFields.every(field => user[field])) {
            toast.warning("Veuillez compléter vos informations personnelles (Matricule, Agence, Poste, Signature, Photo) avant d'ajouter un produit.");
            return;
        }
    } catch (error) {
        console.error("Impossible de vérifier le profil utilisateur", error);
    }

    editedProduct.value = null;
    batchEntryModel.value = {
        id_fournisseur: null,
        date_reception: new Date().toISOString().substr(0, 10),
        lignes: [{
            nom: '',
            description: '',
            reference: '',
            conditionnement: '',
            id_product: null,
            quantite_stock: 1,
            id: Symbol(),
            brandSearch: '',
            quantite_min_alerte: 0,
            prix: 0.0,
            id_categorie: null,
            id_marque: null,
            refSuffix: Math.floor(1000 + Math.random() * 9000).toString()
        }]
    };
    csvFile.value = null;
    isDrawerOpen.value = true;
};

const openPreview = (item: Product) => {
    previewProduct.value = item;
    isPreviewOpen.value = true;
};

const navigateToDetails = () => {
    if (previewProduct.value) {
        router.push(`/products/details/${previewProduct.value.id_product}`);
    }
};

const openEditDrawer = (item: Product) => {
    editedProduct.value = item;

    batchEntryModel.value = {
        id_fournisseur: item.id_fournisseur || null,
        date_reception: new Date().toISOString().substr(0, 10), // La date n'est pas stockée sur le produit, on met la date du jour
        lignes: [{
            nom: item.nom,
            description: item.description,
            reference: item.reference,
            conditionnement: item.conditionnement || '',
            id_product: null,
            quantite_stock: item.quantite_stock, // Champ non modifiable en édition
            id: Symbol(),
            brandSearch: '',
            quantite_min_alerte: item.quantite_min_alerte,
            prix: item.prix,
            id_categorie: item.id_categorie  || null,
            id_marque: item.id_marque  || null,
            refSuffix: '' // Non utilisé en édition
        }]
    };

    isDrawerOpen.value = true;
};

const addLine = () => {
    batchEntryModel.value.lignes.push({
        nom: '',
        description: '',
        reference: '',
        conditionnement: '',
        id_product: null,
        quantite_stock: 1,
        id: Symbol(),
        brandSearch: '',
        quantite_min_alerte: 0,
        prix: 0.0,
        id_categorie: null,
        id_marque: null,
        refSuffix: Math.floor(1000 + Math.random() * 9000).toString()
    });
};

const removeLine = (index: number) => {
    if (batchEntryModel.value.lignes.length > 1) {
        batchEntryModel.value.lignes.splice(index, 1);
    }
};

const handleExistingProductSelection = (line: any) => {
    if (!line?.id_product) return;
    const selected = products.value.find((p) => p.id_product === line.id_product);
    if (!selected) return;

    line.nom = selected.nom;
    line.description = selected.description || '';
    line.reference = selected.reference || '';
    line.conditionnement = selected.conditionnement || '';
    line.quantite_min_alerte = selected.quantite_min_alerte || 0;
    line.prix = selected.prix || 0;
    line.id_categorie = selected.id_categorie || null;
    line.id_marque = selected.id_marque || null;
};

const parseCsvLine = (line: string, delimiter: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
};

const importProductsFromCsv = async () => {
    if (!csvFile.value) {
        toast.warning('Veuillez sélectionner un fichier CSV.');
        return;
    }

    try {
        const text = await csvFile.value.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
            toast.warning('Le fichier CSV est vide ou invalide.');
            return;
        }

        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
        const headerMap: Record<string, number> = {};
        headers.forEach((h, i) => {
            headerMap[h] = i;
        });

        const getCell = (cells: string[], key: string) => {
            const idx = headerMap[key];
            if (idx === undefined) return '';
            return (cells[idx] ?? '').trim();
        };

        const importedLines = lines
            .slice(1)
            .map((line) => {
                const cells = parseCsvLine(line, delimiter);
                const nom = getCell(cells, 'nom');
                const description = getCell(cells, 'description');
                const reference = getCell(cells, 'reference');
                const conditionnement = getCell(cells, 'conditionnement');
                const idCategorie = getCell(cells, 'id_categorie') || null;
                const idMarqueRaw = getCell(cells, 'id_marque');
                const idFournisseurRaw = getCell(cells, 'id_fournisseur');
                const quantiteStock = Number(getCell(cells, 'quantite_stock') || 0);
                const prix = Number(getCell(cells, 'prix') || 0);
                const quantiteMinAlerte = Number(getCell(cells, 'quantite_min_alerte') || 0);

                return {
                    nom,
                    description,
                    reference,
                    conditionnement,
                    quantite_stock: Number.isFinite(quantiteStock) ? quantiteStock : 0,
                    id: Symbol(),
                    brandSearch: '',
                    quantite_min_alerte: Number.isFinite(quantiteMinAlerte) ? quantiteMinAlerte : 0,
                    prix: Number.isFinite(prix) ? prix : 0,
                    id_categorie: idCategorie,
                    id_marque: idMarqueRaw && idMarqueRaw.toLowerCase() !== 'null' ? idMarqueRaw : null,
                    refSuffix: Math.floor(1000 + Math.random() * 9000).toString(),
                    csv_supplier_id: idFournisseurRaw && idFournisseurRaw.toLowerCase() !== 'null' ? idFournisseurRaw : null
                };
            })
            .filter((item) => item.nom);

        if (importedLines.length === 0) {
            toast.warning('Aucune ligne valide à importer.');
            return;
        }

        const firstSupplier = importedLines.find((l: any) => l.csv_supplier_id)?.csv_supplier_id || null;
        if (!batchEntryModel.value.id_fournisseur && firstSupplier) {
            batchEntryModel.value.id_fournisseur = firstSupplier;
        }

        batchEntryModel.value.lignes = importedLines.map((l: any) => ({
            nom: l.nom,
            description: l.description,
            reference: l.reference,
            conditionnement: l.conditionnement,
            id_product: null,
            quantite_stock: l.quantite_stock,
            id: l.id,
            brandSearch: l.brandSearch,
            quantite_min_alerte: l.quantite_min_alerte,
            prix: l.prix,
            id_categorie: l.id_categorie,
            id_marque: l.id_marque,
            refSuffix: l.refSuffix
        }));

        toast.success(`${importedLines.length} produit(s) importé(s) depuis le CSV.`);
    } catch (error) {
        console.error(error);
        toast.error("Erreur lors de l'import du CSV.");
    }
};

const activeLineIndexForBrand = ref(0);
const prepareNewBrand = (name: string, index: number) => {
    newBrandName.value = name;
    activeLineIndexForBrand.value = index;
    isBrandModalOpen.value = true;
};

const handleNewBrand = async () => {
    if (!newBrandName.value) return;
    try {
        const newBrand = (await axiosInstance.post('/brands', { nom: newBrandName.value })).data;
        await fetchSelectOptions();
        const lineToUpdate = batchEntryModel.value.lignes[activeLineIndexForBrand.value];
        if (lineToUpdate) {
            lineToUpdate.id_marque = newBrand.id_marque;
        }
        toast.success("Marque ajoutée avec succès !");
        isBrandModalOpen.value = false;
        newBrandName.value = '';
    } catch (error) {
        toast.error("Erreur lors de l'ajout de la marque.");
    }
};

const handleNewSupplier = async () => {
    if (!newSupplier.value.nom) return;
    try {
        const payload = { ...newSupplier.value, actif: true };
        const newSup = (await axiosInstance.post('/fournisseurs', payload)).data;
        await fetchSelectOptions();
        batchEntryModel.value.id_fournisseur = newSup.id_fournisseur;
        toast.success("Fournisseur ajouté avec succès !");
        isSupplierModalOpen.value = false;
        newSupplier.value = {
            nom: '', contact_nom: '', email: '', telephone: '',
            adresse: '', ville: '', pays: '', notes: ''
        };
    } catch (error) {
        toast.error("Erreur lors de l'ajout du fournisseur.");
    }
};

// Surveiller la saisie pour proposer la création
watch(supplierSearch, (val) => {
    if (val && !suppliers.value.some(s => s.nom.toLowerCase() === val.toLowerCase())) {
        // Si la valeur tapée n'existe pas, on la garde pour la création
        newSupplier.value.nom = val;
    }
});

watch(totalPages, (newTotal) => {
    if (currentPage.value > newTotal) {
        currentPage.value = newTotal;
    }
});

watch(currentPage, (newPage) => {
    if (newPage < 1) currentPage.value = 1;
    if (newPage > totalPages.value) currentPage.value = totalPages.value;
});

watch(search, () => {
    currentPage.value = 1;
});

const generateRef = (line: any, newName: string) => {
    if (!editedProduct.value) {
        const prefix = newName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
        line.reference = prefix ? `REF-${prefix}-${line.refSuffix}` : '';
    }
};

const saveProduct = async () => {
    if (!productForm.value) {
        toast.error("Formulaire indisponible. Réessayez.");
        return;
    }

    const { valid } = await productForm.value.validate();
    if (!valid) {
        toast.warning("Veuillez compléter les champs obligatoires avant d'enregistrer.");
        return;
    }

    if (!batchEntryModel.value.lignes.length) {
        toast.warning("Aucune ligne produit à enregistrer.");
        return;
    }

    isFormLoading.value = true;
    try {
        if (editedProduct.value) {
            // --- Modification (PUT) ---
            const line = batchEntryModel.value.lignes[0];
            const payload = {
                nom: line.nom,
                description: line.description,
                reference: line.reference,
                conditionnement: line.conditionnement,
                quantite_min_alerte: line.quantite_min_alerte,
                prix: line.prix,
                agence: editedProduct.value.agence || currentUser.value?.agence || '',
                id_pole: editedProduct.value.id_pole || currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole || null,
                id_categorie: line.id_categorie,
                id_marque: line.id_marque,
                id_fournisseur: batchEntryModel.value.id_fournisseur,
            };
            await axiosInstance.put(`/products/${editedProduct.value.id_product}`, payload);
            toast.success('Produit modifié avec succès !');
        } else {
            // --- Création (POST) ---
            const numOrdre = `ORD-${Date.now()}`; // Génération d'un numéro d'ordre unique pour le lot
            for (const line of batchEntryModel.value.lignes) {
                const selectedExisting = line.id_product ? products.value.find((p) => p.id_product === line.id_product) : null;
                const productPayload = {
                    id_product: selectedExisting?.id_product || null,
                    nom: selectedExisting?.nom || line.nom,
                    description: selectedExisting?.description || line.description,
                    reference: selectedExisting?.reference || line.reference,
                    conditionnement: selectedExisting?.conditionnement || line.conditionnement,
                    quantite_min_alerte: selectedExisting?.quantite_min_alerte ?? line.quantite_min_alerte,
                    prix: selectedExisting?.prix ?? line.prix,
                    agence: selectedExisting?.agence || currentUser.value?.agence || '',
                    id_pole: selectedExisting?.id_pole || currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole || null,
                    id_categorie: selectedExisting?.id_categorie || line.id_categorie,
                    id_marque: selectedExisting?.id_marque ?? line.id_marque,
                    id_fournisseur: batchEntryModel.value.id_fournisseur,
                    quantite_stock: 0 // La quantité est gérée par l'entrée en stock
                };
                const productResponse = await axiosInstance.post('/products', productPayload);
                const targetProductId = productResponse.data.id_product;

                // Créer l'entrée en stock initiale
                if (line.quantite_stock > 0 && targetProductId) {
                    const stockEntryPayload = {
                        quantite_entree: line.quantite_stock,
                        id_fournisseur: batchEntryModel.value.id_fournisseur,
                        date_reception: batchEntryModel.value.date_reception,
                        prix_achat: line.prix,
                        num_ordre: numOrdre
                    };
                    await axiosInstance.post(`/products/${targetProductId}/entries`, stockEntryPayload);
                }
            }
            toast.success(`${batchEntryModel.value.lignes.length} produit(s) ajouté(s) avec succès !`);
        }

        isDrawerOpen.value = false;
        await fetchProducts(); // Rafraè®chir la liste

    } catch (error: any) {
        const action = editedProduct.value ? 'modification' : 'création';
        const apiMessage = error?.response?.data?.message || error?.response?.data?.error || '';
        toast.error(apiMessage ? `${apiMessage}` : `Erreur lors de la ${action} du produit.`);
        console.error(error);
    } finally {
        isFormLoading.value = false;
    }
};

const openDeleteDialog = (item: Product) => {
    productToDelete.value = item;
    isDeleteDialogOpen.value = true;
};

const deleteProduct = async () => {
    if (!productToDelete.value) return;
    try {
        await axiosInstance.delete(`/products/${productToDelete.value.id_product}`);
        toast.success('Produit supprimé avec succès !');
        isDeleteDialogOpen.value = false;
        await fetchProducts();
    } catch (error) {
        toast.error("Erreur lors de la suppression du produit.");
    }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value || 0);
};

const exportToExcel = () => {
    const rows = filteredProducts.value;
    if (!rows.length) {
        toast.warning("Aucun produit à exporter.");
        return;
    }

    let totalGeneral = 0;
    const bodyRows = rows
        .map((item, index) => {
            const totalValue = (Number(item.prix) || 0) * (Number(item.quantite_stock) || 0);
            totalGeneral += totalValue;
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(item.nom || '')}</td>
                    <td>${escapeHtml(item.reference || '-')}</td>
                    <td>${escapeHtml(item.conditionnement || '-')}</td>
                    <td>${escapeHtml(getCategoryName(item.id_categorie))}</td>
                    <td>${escapeHtml(item.agence || '-')}</td>
                    <td style="text-align:center;">${item.quantite_stock ?? 0}</td>
                    <td style="text-align:right;">${item.prix ?? 0}</td>
                    <td style="text-align:right;">${totalValue}</td>
                </tr>
            `;
        })
        .join('');

    const tableHtml = `
        <html>
            <head>
                <meta charset="UTF-8" />
            </head>
            <body>
                <table border="1" style="border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Produit</th>
                            <th>Référence</th>
                            <th>Conditionnement</th>
                            <th>Catégorie</th>
                            <th>Agence</th>
                            <th>Stock</th>
                            <th>Prix unitaire</th>
                            <th>Valeur totale</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                        <tr>
                            <td colspan="8" style="text-align:right;"><strong>Total général</strong></td>
                            <td style="text-align:right;"><strong>${totalGeneral}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const agency = (currentUser.value?.agence || 'all').replace(/\s+/g, '-');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `produits-${agency}-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Produits en stock" sub-title="Liste complète des produits disponibles dans l'inventaire" :loading="loading" :empty-state="{
                title: 'Aucun produit trouvé',
                subtitle: 'Essayez de modifier vos critères de recherche'
            }" style="padding: 2rem;">
                <template v-slot:action>
                    <div class="d-flex ga-2">
                        <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                        <v-btn color="success" variant="outlined" prepend-icon="mdi-file-excel" @click="exportToExcel">Exporter Excel</v-btn>
                        <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddDrawer">Ajouter un produit</v-btn>
                    </div>
                </template>

                <v-text-field
                    v-model="search"
                    prepend-inner-icon="mdi-magnify"
                    label="Rechercher un produit, une référence, une catégorie ou une agence..."
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-4"
                ></v-text-field>

                <v-table class="mt-5" :loading="loading" loading-text="Chargement des produits..." hover>
                    <thead>
                        <tr>
                            <th class="text-left text-uppercase">N°</th>
                            <th class="text-left text-uppercase">Nom du produit</th>
                            <th class="text-left text-uppercase">Référence</th>
                            <th class="text-left text-uppercase">Conditionnement</th>
                            <th class="text-left text-uppercase">Prix Unitaire</th>
                            <th class="text-left text-uppercase">Catégorie</th>
                            <th class="text-left text-uppercase">Agence</th>
                            <th class="text-left text-uppercase">Quantité en stock</th>
                            <th class="text-right text-uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody v-if="!loading">
                        <tr v-for="(item, index) in paginatedProducts" :key="item.id_product" @click="openPreview(item)" style="cursor: pointer">
                            <td>{{ getRowNumber(index) }}</td>
                            <td>{{ item.nom }}</td>
                            <td>{{ item.reference }}</td>
                            <td>{{ item.conditionnement || '-' }}</td>
                            <td>{{ formatCurrency(item.prix) }}</td>
                            <td>{{ getCategoryName(item.id_categorie) }}</td>
                            <td>{{ item.agence || '-' }}</td>
                            <td>
                                <v-chip :color="item.quantite_stock <= item.quantite_min_alerte ? 'error' : 'success'" size="small">
                                    {{ item.quantite_stock }}
                                </v-chip>
                            </td>
                            <td class="text-right">
                                <v-btn icon variant="text" color="primary" @click.stop="openEditDrawer(item)">
                                    <PencilIcon size="20" />
                                </v-btn>
                                <v-btn icon variant="text" color="error" @click.stop="openDeleteDialog(item)">
                                    <TrashIcon size="20" />
                                </v-btn>
                            </td>
                        </tr>
                        <tr v-if="paginatedProducts.length === 0">
                            <td colspan="9" class="text-center text-medium-emphasis py-4">Aucun produit disponible.</td>
                        </tr>
                    </tbody>
                </v-table>

                <div class="d-flex justify-center mt-4" v-if="totalPages > 1">
                    <v-pagination v-model="currentPage" :length="totalPages" rounded="circle"></v-pagination>
                </div>
            </UiParentCard>
        </v-col>

        <!-- Drawer pour ajouter/modifier un produit -->
        <v-navigation-drawer v-model="isDrawerOpen" location="right" temporary width="800">
            <div class="pa-5">
                <div class="d-flex justify-space-between align-center mb-5">
                    <h3 class="text-h5">{{ drawerTitle }}</h3>
                    <v-btn icon="mdi-close" variant="text" @click="isDrawerOpen = false"></v-btn>
                </div>

                <v-form ref="productForm" @submit.prevent="saveProduct">
                    <!-- Champs communs à l'entrée -->
                    <v-row>
                        <v-col cols="12" md="6">
                            <v-label class="font-weight-bold mb-1">Fournisseur</v-label>
                            <v-autocomplete v-model="batchEntryModel.id_fournisseur" v-model:search="supplierSearch" :items="suppliers" item-title="nom" item-value="id_fournisseur" variant="outlined" color="primary" label="Sélectionner ou créer" :rules="[v => !!v || 'Requis']">
                                <template v-slot:no-data>
                                    <v-list-item>
                                        <v-list-item-title>
                                            Aucun fournisseur. Créer "<strong>{{ supplierSearch }}</strong>"?
                                        </v-list-item-title>
                                        <template v-slot:append>
                                            <v-btn color="primary" variant="text" @click="isSupplierModalOpen = true">Ajouter</v-btn>
                                        </template>
                                    </v-list-item>
                                </template>
                            </v-autocomplete>
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-label class="font-weight-bold mb-1">Date de réception</v-label>
                            <v-text-field v-model="batchEntryModel.date_reception" type="date" variant="outlined" color="primary" :rules="[v => !!v || 'Requis']"></v-text-field>
                        </v-col>
                    </v-row>

                    <v-row v-if="!editedProduct">
                        <v-col cols="12" md="8">
                            <v-file-input
                                v-model="csvFile"
                                label="Importer un fichier CSV"
                                variant="outlined"
                                density="compact"
                                prepend-icon="mdi-file-delimited-outline"
                                accept=".csv,text/csv"
                                hide-details
                            ></v-file-input>
                        </v-col>
                        <v-col cols="12" md="4" class="d-flex align-end">
                            <v-btn color="secondary" variant="outlined" block prepend-icon="mdi-upload" @click="importProductsFromCsv">
                                Importer CSV
                            </v-btn>
                        </v-col>
                    </v-row>

                    <v-divider class="my-4"></v-divider>

                    <!-- Lignes de produits -->
                    <div v-for="(line, index) in batchEntryModel.lignes" :key="line.id" class="mb-4">
                        <v-card variant="outlined">
                            <v-card-title class="d-flex justify-space-between text-body-2 bg-grey-lighten-4 pa-2">
                                <span>Produit #{{ index + 1 }}</span>
                                <v-btn v-if="!editedProduct" icon color="error" variant="text" size="small" @click="removeLine(index)" :disabled="batchEntryModel.lignes.length === 1"><TrashIcon size="20" /></v-btn>
                            </v-card-title>
                            <v-card-text>
                                <v-row dense>
                                    <v-col cols="12" v-if="!editedProduct">
                                        <v-select
                                            v-model="line.id_product"
                                            :items="productSelectOptions"
                                            item-title="product_label"
                                            item-value="id_product"
                                            label="Produit existant (optionnel)"
                                            variant="outlined"
                                            density="compact"
                                            clearable
                                            @update:model-value="handleExistingProductSelection(line)"
                                        ></v-select>
                                    </v-col>
                                    <v-col cols="12"><v-text-field v-model="line.nom" label="Nom du produit" variant="outlined" density="compact" :rules="[v => line.id_product || !!v || 'Requis']" @update:model-value="generateRef(line, $event)" :disabled="!!line.id_product && !editedProduct"></v-text-field></v-col>
                                    <v-col cols="12" md="6"><v-text-field v-model="line.reference" label="Référence" variant="outlined" density="compact" :disabled="!!line.id_product && !editedProduct"></v-text-field></v-col>
                                    <v-col cols="12" md="6"><v-text-field v-model="line.conditionnement" label="Conditionnement" variant="outlined" density="compact" :disabled="!!line.id_product && !editedProduct"></v-text-field></v-col>
                                    <v-col cols="12" md="6"><v-select v-model="line.id_categorie" :items="categoryOptions" item-title="category_label" item-value="id_categorie" label="Catégorie" variant="outlined" density="compact" :rules="[v => line.id_product || !!v || 'Requis']" :disabled="!!line.id_product && !editedProduct"></v-select></v-col>
                                    <v-col cols="12" md="4"><v-text-field v-model.number="line.prix" type="number" label="Prix Unitaire" variant="outlined" density="compact" min="0"></v-text-field></v-col>
                                    <v-col cols="12" md="4" v-if="!editedProduct"><v-text-field v-model.number="line.quantite_stock" type="number" label="Quantité initiale" variant="outlined" density="compact" min="0"></v-text-field></v-col>
                                    <v-col cols="12" md="4"><v-text-field v-model.number="line.quantite_min_alerte" type="number" label="Seuil d'alerte" variant="outlined" density="compact" min="0" :disabled="!!line.id_product && !editedProduct"></v-text-field></v-col>
                                    <v-col cols="12" md="6">
                                        <v-autocomplete v-model="line.id_marque" v-model:search="line.brandSearch" :items="brands" item-title="nom" item-value="id_marque" variant="outlined" density="compact" label="Marque (optionnel)" :disabled="!!line.id_product && !editedProduct">
                                            <template v-slot:no-data>
                                                <v-list-item>
                                                    <v-list-item-title>
                                                        Créer "<strong>{{ line.brandSearch }}</strong>"?
                                                    </v-list-item-title>
                                                    <template v-slot:append>
                                                        <v-btn color="primary" variant="text" @click="prepareNewBrand(line.brandSearch, index)">Ajouter</v-btn>
                                                    </template>
                                                </v-list-item>
                                            </template>
                                        </v-autocomplete>
                                    </v-col>
                                    <v-col cols="12"><v-textarea v-model="line.description" label="Description (optionnel)" variant="outlined" density="compact" rows="2" :disabled="!!line.id_product && !editedProduct"></v-textarea></v-col>
                                </v-row>
                            </v-card-text>
                        </v-card>
                    </div>

                    <v-btn v-if="!editedProduct" color="secondary" variant="tonal" block @click="addLine" class="mb-4">
                        <PlusIcon size="20" class="mr-2"/> Ajouter un autre produit
                    </v-btn>

                    <v-btn color="primary" type="submit" block class="mt-4" :loading="isFormLoading">Enregistrer</v-btn>
                </v-form>
            </div>
        </v-navigation-drawer>

        <!-- Modale pour ajouter une marque -->
        <v-dialog v-model="isBrandModalOpen" max-width="400">
            <v-card>
                <v-card-title>Ajouter une nouvelle marque</v-card-title>
                <v-card-text>
                    <v-text-field v-model="newBrandName" label="Nom de la marque" variant="outlined" autofocus></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn text @click="isBrandModalOpen = false">Annuler</v-btn>
                    <v-btn color="primary" @click="handleNewBrand">Enregistrer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Modale pour ajouter un fournisseur -->
        <v-dialog v-model="isSupplierModalOpen" max-width="600">
            <v-card>
                <v-card-title>Ajouter un nouveau fournisseur</v-card-title>
                <v-card-text>
                    <v-row>
                        <v-col cols="12"><v-text-field v-model="newSupplier.nom" label="Nom du fournisseur" variant="outlined"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-text-field v-model="newSupplier.contact_nom" label="Nom du contact" variant="outlined"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-text-field v-model="newSupplier.email" label="Email" variant="outlined"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-text-field v-model="newSupplier.telephone" label="Téléphone" variant="outlined"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-text-field v-model="newSupplier.adresse" label="Adresse" variant="outlined"></v-text-field></v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn text @click="isSupplierModalOpen = false">Annuler</v-btn>
                    <v-btn color="primary" @click="handleNewSupplier">Enregistrer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Dialogue de confirmation de suppression -->
        <v-dialog v-model="isDeleteDialogOpen" max-width="500">
            <v-card>
                <v-card-title class="text-h5">Confirmer la suppression</v-card-title>
                <v-card-text>
                    Êtes-vous sûr de vouloir supprimer le produit "<strong>{{ productToDelete?.nom }}</strong>" ? Cette action est irréversible.
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn text @click="isDeleteDialogOpen = false">Annuler</v-btn>
                    <v-btn color="error" @click="deleteProduct">Supprimer</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Dialogue de prévisualisation -->
        <v-dialog v-model="isPreviewOpen" max-width="600">
            <v-card v-if="previewProduct">
                <v-card-title class="d-flex justify-space-between align-center">
                    Détails rapides
                    <v-btn icon="mdi-close" variant="text" @click="isPreviewOpen = false"></v-btn>
                </v-card-title>
                <v-card-text>
                    <v-row>
                        <v-col cols="12" md="6">
                            <strong>Nom:</strong> {{ previewProduct.nom }}
                        </v-col>
                        <v-col cols="12" md="6">
                            <strong>Référence:</strong> {{ previewProduct.reference }}
                        </v-col>
                        <v-col cols="12" md="6">
                            <strong>Conditionnement:</strong> {{ previewProduct.conditionnement || '-' }}
                        </v-col>
                        <v-col cols="12" md="6">
                            <strong>Prix:</strong> {{ formatCurrency(previewProduct.prix) }}
                        </v-col>
                        <v-col cols="12" md="6">
                            <strong>Catégorie:</strong> {{ getCategoryName(previewProduct.id_categorie) }}
                        </v-col>
                        <v-col cols="12" md="6">
                            <strong>Agence:</strong> {{ previewProduct.agence || '-' }}
                        </v-col>
                        <v-col cols="12" md="6">
                            <strong>Stock:</strong> {{ previewProduct.quantite_stock }}
                        </v-col>
                        <v-col cols="12">
                            <strong>Description:</strong> {{ previewProduct.description || 'Aucune description' }}
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" variant="elevated" @click="navigateToDetails">Voir tous les détails</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

    </v-row>
</template>

