const dbUrl = "https://szhxxohizqnwcmsltjtq.supabase.co";
const dbKey = "sb_publishable_hfQrBZ4OYrkHjUxvtzCL_g_mi05THSO";

let mySupabase = null;
let myUser = null;
let myPhoto = null;
let myWhatsapp = null;
let monAbonnement = 'standard';
let monNombreArticles = 0;
let articleASupprimer = null;
let pageActuelle = 1;
const articlesParPage = 12;

// --- GESTION DES BELLES MODALES ---
function afficherAlerteCustom(titre, message, typeAlerte) {
    const modal = document.getElementById('modal-alerte');
    const content = document.getElementById('modal-alerte-content');
    const icon = document.getElementById('alerte-icon');

    document.getElementById('alerte-titre').innerText = titre;
    document.getElementById('alerte-message').innerText = message;

    if (typeAlerte === 'succes') {
        icon.className = "w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 bg-green-100 text-green-500";
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
    } else {
        icon.className = "w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 bg-red-100 text-red-500";
        icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    }

    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('opacity-100'); content.classList.remove('scale-90'); }, 10);
}

function fermerAlerte() {
    const modal = document.getElementById('modal-alerte');
    const content = document.getElementById('modal-alerte-content');
    modal.classList.remove('opacity-100');
    content.classList.add('scale-90');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function demanderConfirmation(id) {
    articleASupprimer = id;
    const modal = document.getElementById('modal-confirm');
    const content = document.getElementById('modal-confirm-content');
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('opacity-100'); content.classList.remove('scale-90'); }, 10);
}

function fermerConfirm() {
    articleASupprimer = null;
    const modal = document.getElementById('modal-confirm');
    const content = document.getElementById('modal-confirm-content');
    modal.classList.remove('opacity-100');
    content.classList.add('scale-90');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

// Action de confirmation de suppression
document.getElementById('btn-confirm-action').addEventListener('click', async () => {
    if(articleASupprimer) {
        await mySupabase.from('produits').delete().eq('id', articleASupprimer);
        fermerConfirm();
        chargerMesArticles();
        afficherAlerteCustom("Retiré", "L'article a été effacé de votre boutique.", "succes");
    }
});

// --- 1. BOUTON ORANGE : PUBLIER ---
async function publierAnnonce() {
    if (monAbonnement === 'standard' && monNombreArticles >= 5) {
afficherAlerteCustom("Limite atteinte", "Vous avez utilisé vos 5 emplacements gratuits. Passez PRO pour un stock ILLIMITÉ.", "erreur");
        return;
    }

    const nomP = document.getElementById('pNom').value;
    const prixP = document.getElementById('pPrix').value;
    const catP = document.getElementById('pCat').value;
    const descP = document.getElementById('pDesc').value;

    if (!nomP || !prixP) { afficherAlerteCustom("Attention", "Le nom et le prix sont obligatoires.", "erreur"); return; }
    if (!myPhoto) { afficherAlerteCustom("Attention", "N'oubliez pas la photo de l'article.", "erreur"); return; }

    const btn = document.getElementById('btnPublier');
    btn.innerText = "ENVOI EN COURS...";
    btn.disabled = true;

    try {
        // --- NOUVEAU : Configuration de la compression ---
        const optionsCompression = {
            maxSizeMB: 0.15, // Compresse à 150 Ko maximum (parfait pour Cœur de Marché)
            maxWidthOrHeight: 1024,
            useWebWorker: true,
            fileType: 'image/webp' // Format moderne et très léger
        };

        btn.innerText = "COMPRESSION..."; // Indique au vendeur ce qui se passe

        // On compresse la photo stockée dans la variable globale myPhoto
        const imageCompressee = await imageCompression(myPhoto, optionsCompression);
        // ----------------------------------------------------

        btn.innerText = "ENVOI EN COURS...";

        // On utilise l'extension .webp au lieu de .jpg
        const nomFichier = myUser.id + "_" + Date.now() + ".webp";

        // On envoie l'image compressée à Supabase au lieu de myPhoto
        const { error: errPhoto } = await mySupabase.storage.from('images').upload(nomFichier, imageCompressee);

        if (errPhoto) throw new Error("Erreur Photo : " + errPhoto.message);

        const { data: { publicUrl } } = mySupabase.storage.from('images').getPublicUrl(nomFichier);

        let statutArticle = 'actif';

        const { error: errProduit } = await mySupabase.from('produits').insert([{
            nom: nomP, prix: prixP, categorie: catP, description: descP, vendeur: myWhatsapp, image: publicUrl, statut: statutArticle
        }]);

        if (errProduit) throw new Error(errProduit.message);

        afficherAlerteCustom("MAGNIFIQUE !", "Votre article est en ligne et visible par tous.", "succes");

        setTimeout(() => { window.location.reload(); }, 2000);

    } catch (erreur) {
        afficherAlerteCustom("ÉCHEC", erreur.message, "erreur");
        btn.innerText = "Publier sur le marché";
        btn.disabled = false;
    }
                }

// --- 2. BOUTON SORTIR ---
async function deconnecter() {
    if (mySupabase) { await mySupabase.auth.signOut(); }
    window.location.href = "vendre.html";
}

// --- 3. SELECTION PHOTO ---
document.getElementById('photoInput').addEventListener('change', function(e) {
    if(e.target.files && e.target.files[0]) {
        myPhoto = e.target.files[0];
        document.getElementById('btnPhotoText').innerText = "IMAGE PRÊTE ✅";
        document.getElementById('btnPhotoText').style.color = "#16a34a";
        document.getElementById('iconPhoto').style.color = "#16a34a";
    }
});

// --- 4. CHARGER LES ARTICLES DU VENDEUR ---
async function chargerMesArticles(page = 1) {
    if (!myWhatsapp) return;
    pageActuelle = page;
    const container = document.getElementById('mes-articles');
    const from = (page - 1) * articlesParPage;
    const to = from + articlesParPage - 1;

    const { data, error, count } = await mySupabase
        .from('produits')
        .select('*', { count: 'exact' })
        .eq('vendeur', myWhatsapp)
        .order('dateajout', { ascending: false })
        .range(from, to);

    if (error || !data || data.length === 0) {
        if (page === 1) container.innerHTML = '<p class="text-gray-400 text-sm font-bold col-span-2 text-center py-4">Vous n\'avez aucun article en ligne.</p>';
        document.getElementById('pagination-controls').classList.add('hidden');
        return;
    }

    monNombreArticles = count;
    window.mesArticlesLocaux = data;

    container.innerHTML = data.map(p => `
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative">
            ${p.statut === 'attente' ? `<span class="absolute top-1 left-1 bg-gray-800 text-white text-[7px] px-2 py-0.5 rounded shadow-md z-10">EN REVUE</span>` : ''}
            <img src="${p.image}" class="w-full h-24 object-cover">
            <div class="p-2 flex-1 flex flex-col">
                <h4 class="font-black text-[10px] text-gray-800 uppercase truncate mb-1">${p.nom}</h4>
                <span class="text-orange-500 font-black text-xs mb-3">${p.prix} F</span>
                <div class="flex gap-1 mt-auto">
                    <button onclick="demanderConfirmation('${p.id}')" class="w-9 bg-red-100 text-red-600 rounded-lg py-1"><i class="fas fa-trash-alt"></i></button>
                    <button onclick="ouvrirModification('${p.id}')" class="w-9 bg-blue-100 text-blue-600 rounded-lg py-1"><i class="fas fa-edit"></i></button>
                    <button onclick="demanderBoost('${p.nom.replace(/'/g, "\\'")}')" class="flex-1 bg-orange-100 text-orange-600 rounded-lg text-[9px] font-black py-1"><i class="fas fa-rocket"></i> BOOST</button>
                </div>
            </div>
        </div>
    `).join('');

    const limiteAffichage = (monAbonnement === 'standard') ? 5 : "Illimité";
    document.getElementById('compteur-articles').innerText = monNombreArticles + " / " + limiteAffichage;

    if (monAbonnement === 'standard' && monNombreArticles >= 5) {
        document.getElementById('formulaire-annonce').classList.add('hidden');
        document.getElementById('message-limite').classList.remove('hidden');
    }

    mettreAJourPagination(count);
}

// --- FONCTION UPGRADE VIP ---
function contacterAdminUpgrade() {
    const nomElem = document.getElementById('nom-boutique');
    const nomBoutique = nomElem ? nomElem.innerText : "ma boutique";

    const message = encodeURIComponent(`Bonjour Cœur de Marché, je suis le gérant de la boutique "${nomBoutique}". Je souhaite passer au statut de VENDEUR VIP pour 2000F/mois et booster mes ventes.`);

    window.open(`https://wa.me/2250576326645?text=${message}`);
}

// --- FONCTION UPGRADE PRO ---
function contacterAdminPro() {
    const nomElem = document.getElementById('nom-boutique');
    const nomBoutique = nomElem ? nomElem.innerText : "ma boutique";

    const message = encodeURIComponent(`Bonjour Cœur de Marché, ma boutique "${nomBoutique}" a atteint la limite gratuite de 5 articles. Je souhaite passer au statut PRO.`);

    window.open(`https://wa.me/2250576326645?text=${message}`);
}

// --- FONCTION DEMANDER UN BOOST ---
function demanderBoost(nomArticle) {
    const nomBoutique = document.getElementById('nom-boutique').innerText;
    const message = encodeURIComponent(`Bonjour Cœur de Marché, je suis la boutique "${nomBoutique}". Je souhaite payer un BOOST VIP pour mon article : ${nomArticle}`);
    window.open(`https://wa.me/2250576326645?text=${message}`);
}

// --- FONCTIONS DE MODIFICATION ---
function ouvrirModification(id) {
    const article = window.mesArticlesLocaux.find(a => String(a.id) === String(id));
    if (!article) return;

    document.getElementById('mod-id').value = article.id;
    document.getElementById('mod-nom').value = article.nom;
    document.getElementById('mod-prix').value = article.prix;
    document.getElementById('mod-desc').value = article.description || "";
    window.urlImageActuelle = article.image;

    const modal = document.getElementById('modal-modifier');
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('opacity-100');
        modal.children[0].classList.remove('scale-90');
    }, 10);
}

function fermerModification() {
    const modal = document.getElementById('modal-modifier');
    modal.classList.remove('opacity-100');
    modal.children[0].classList.add('scale-90');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

async function sauvegarderModification() {
    const btn = document.getElementById('btn-sauver-mod');
    const id = document.getElementById('mod-id').value;
    const nom = document.getElementById('mod-nom').value;
    const prix = document.getElementById('mod-prix').value;
    const desc = document.getElementById('mod-desc').value;

    if (!nom || !prix) {
        afficherAlerteCustom("Attention", "Le nom et le prix sont obligatoires.", "erreur");
        return;
    }

    btn.innerText = "EN COURS...";
    btn.disabled = true;

    try {
        const { error } = await mySupabase
            .from('produits')
            .update({ nom: nom, prix: prix, description: desc })
            .eq('id', id);

        if (error) throw new Error(error.message);

        afficherAlerteCustom("Super", "Votre article a été modifié.", "succes");
        fermerModification();
        chargerMesArticles(pageActuelle); 

    } catch (erreur) {
        afficherAlerteCustom("Échec", "Erreur lors de la modification.", "erreur");
    } finally {
        btn.innerText = "SAUVEGARDER";
        btn.disabled = false;
    }
            }

function mettreAJourPagination(total) {
    const controls = document.getElementById('pagination-controls');

    // On s'assure qu'il y a toujours au moins 1 page affichée, même avec 0 article
    const totalPages = Math.max(1, Math.ceil(total / articlesParPage));

    // On force l'affichage de la zone de pagination
    controls.classList.remove('hidden');
    controls.innerHTML = ''; // On vide l'ancienne pagination

    // On génère les puces numérotées de 1 jusqu'à la dernière page
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.onclick = () => {
            chargerMesArticles(i);
            document.getElementById('mes-articles').scrollIntoView({ behavior: 'smooth' });
        };

        // On applique le design violet pour la page active, et blanc pour les autres
        if (i === pageActuelle) {
            btn.className = "w-10 h-10 rounded-xl bg-[#5b21b6] text-white font-bold text-sm shadow-md flex items-center justify-center transition-all";
        } else {
            btn.className = "w-10 h-10 rounded-xl bg-white text-gray-700 font-bold text-sm shadow-sm border border-gray-200 flex items-center justify-center active:scale-95 transition-all";
        }
        controls.appendChild(btn);
    }

    // On ajoute le bouton "Suivant" en bas uniquement s'il y a une page d'après
    if (pageActuelle < totalPages) {
        // Un div invisible pour forcer le bouton "Suivant" à passer à la ligne
        const sautDeLigne = document.createElement('div');
        sautDeLigne.className = "w-full h-2";
        controls.appendChild(sautDeLigne);

        const btnNext = document.createElement('button');
        btnNext.innerText = "Suivant";
        btnNext.onclick = () => {
            chargerMesArticles(pageActuelle + 1);
            document.getElementById('mes-articles').scrollIntoView({ behavior: 'smooth' });
        };
        btnNext.className = "px-6 py-2 rounded-full bg-white text-[#5b21b6] border-2 border-[#5b21b6] font-bold text-sm shadow-sm active:scale-95 transition-all";
        controls.appendChild(btnNext);
    }
}

// --- 6. DEMARRAGE ET VERIFICATION PROFIL ---
async function demarrerBureau() {
    try {
        if (typeof window.supabase === 'undefined') return;

        mySupabase = window.supabase.createClient(dbUrl, dbKey);
        const { data: { session } } = await mySupabase.auth.getSession();

        if (!session) {
            window.location.href = "vendre.html";
            return;
        }

        myUser = session.user;

        const { data: vendeur, error: errVendeur } = await mySupabase
            .from('vendeurs')
            .select('*')
            .eq('id', myUser.id)
            .single();

        if (vendeur) {
            // AVIS D'EXPERT : On affiche le badge de confiance si le vendeur est PRO
            if (monAbonnement === 'pro') {
                document.getElementById('badge-pro').classList.remove('hidden');
            }

            document.getElementById('nom-boutique').innerText = vendeur.nom_boutique || "Boutique";
            document.getElementById('nom-vendeur').innerText = "Gérant : " + (vendeur.proprietaire || "Gérant");
            myWhatsapp = vendeur.whatsapp;

            monAbonnement = vendeur.abonnement || 'standard';
            const badge = document.getElementById('badge-abonnement');
            badge.innerText = monAbonnement;
            badge.classList.remove('hidden');
            badge.className = "text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm badge-" + monAbonnement;
            if (monAbonnement === 'standard') {
                document.getElementById('zone-upgrade').classList.remove('hidden');
            }
            chargerMesArticles();
        }

    } catch (erreur) {
        console.log("Erreur de démarrage", erreur);
    }
}

async function optimiserImageExistante() {
    const id = document.getElementById('mod-id').value;
    const btnOpti = document.getElementById('btn-optimiser-img');

    if (!window.urlImageActuelle) {
        afficherAlerteCustom("Attention", "Aucune image trouvée pour cet article.", "erreur");
        return;
    }

    btnOpti.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Récupération...';
    btnOpti.disabled = true;

    try {
        const reponse = await fetch(window.urlImageActuelle);
        const blob = await reponse.blob();
        const fichierVirtuel = new File([blob], "image_recuperee.webp", { type: blob.type });

        btnOpti.innerHTML = '<i class="fas fa-compress fa-beat"></i> Compression...';
        const optionsCompression = { maxSizeMB: 0.15, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/webp' };
        const imageCompressee = await imageCompression(fichierVirtuel, optionsCompression);

        const nomFichier = myWhatsapp + "_opts_" + Date.now() + ".webp";

        // --- NOUVEAU : SUPPRESSION DE L'ANCIENNE PHOTO ---
        const partiesUrl = window.urlImageActuelle.split('/images/');
        if (partiesUrl.length > 1) {
            const ancienNomFichier = partiesUrl[1];
            await mySupabase.storage.from('images').remove([ancienNomFichier]);
        }
        // ---------------------------------------------------

        btnOpti.innerHTML = '<i class="fas fa-upload fa-bounce"></i> Envoi...';

        const { error: errPhoto } = await mySupabase.storage.from('images').upload(nomFichier, imageCompressee);

        if (errPhoto) throw new Error("Erreur d'envoi : " + errPhoto.message);

        const { data: { publicUrl } } = mySupabase.storage.from('images').getPublicUrl(nomFichier);

        btnOpti.innerHTML = '<i class="fas fa-database"></i> Mise à jour...';
        const { error: errDb } = await mySupabase
            .from('produits')
            .update({ image: publicUrl })
            .eq('id', id);

        if (errDb) throw new Error(errDb.message);

        afficherAlerteCustom("MAGNIFIQUE !", "L'image a été allégée et remplacée avec succès !", "succes");
        fermerModification();
        chargerMesArticles(pageActuelle);

    } catch (erreur) {
        afficherAlerteCustom("Échec", "Erreur : " + erreur.message, "erreur");
    } finally {
        btnOpti.innerHTML = '<i class="fas fa-compress-arrows-alt"></i> Alléger l\'image actuelle';
        btnOpti.disabled = false;
    }                                                                                       
}

demarrerBureau();


// Expose functions to global scope for inline event listeners
window.deconnecter = deconnecter;
window.demanderConfirmation = demanderConfirmation;
window.mettreAJourPagination = mettreAJourPagination;
window.contacterAdminUpgrade = contacterAdminUpgrade;
window.ouvrirModification = ouvrirModification;
window.demarrerBureau = demarrerBureau;
window.afficherAlerteCustom = afficherAlerteCustom;
window.demanderBoost = demanderBoost;
window.chargerMesArticles = chargerMesArticles;
window.fermerConfirm = fermerConfirm;
window.contacterAdminPro = contacterAdminPro;
window.fermerAlerte = fermerAlerte;
window.optimiserImageExistante = optimiserImageExistante;
window.publierAnnonce = publierAnnonce;
window.sauvegarderModification = sauvegarderModification;
window.fermerModification = fermerModification;
            
