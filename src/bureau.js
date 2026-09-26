const dbUrl = "https://szhxxohizqnwcmsltjtq.supabase.co";
const dbKey = "sb_publishable_hfQrBZ4OYrkHjUxvtzCL_g_mi05THSO";
const NUMERO_ADMIN = "2250576326645";
const NUMERO_LIVRAISON = "2250143812759";

let mySupabase = null;
let myUser = null;
let myPhoto = null;
let modPhotoFile = null;
let myWhatsapp = null;
let monNomBoutique = "Ma Boutique";
let monAbonnement = 'standard';
let monNombreArticles = 0;
let articleASupprimer = null;
let pageActuelle = 1;
const articlesParPage = 12;

window.mesArticlesLocaux = [];
window.mesCommandesLocales = [];

function echapperHTML(texte) {
    const div = document.createElement('div');
    div.textContent = String(texte ?? '');
    return div.innerHTML;
}

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
    setTimeout(() => {
        modal.classList.add('opacity-100');
        content.classList.remove('scale-90');
    }, 10);
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
    setTimeout(() => {
        modal.classList.add('opacity-100');
        content.classList.remove('scale-90');
    }, 10);
}

function fermerConfirm() {
    articleASupprimer = null;
    const modal = document.getElementById('modal-confirm');
    const content = document.getElementById('modal-confirm-content');
    modal.classList.remove('opacity-100');
    content.classList.add('scale-90');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

async function supprimerImageStorage(urlImage) {
    if (!urlImage || !mySupabase) return;
    try {
        const partiesUrl = String(urlImage).split('/images/');
        if (partiesUrl.length > 1) {
            const nomFichier = partiesUrl[1].split('?')[0];
            await mySupabase.storage.from('images').remove([nomFichier]);
        }
    } catch (e) {
        console.log("Nettoyage image ignoré", e);
    }
}

document.getElementById('btn-confirm-action').addEventListener('click', async () => {
    if (!articleASupprimer) return;
    const btn = document.getElementById('btn-confirm-action');
    btn.innerText = "Suppression...";
    btn.disabled = true;

    try {
        const articleObj = window.mesArticlesLocaux.find(a => String(a.id) === String(articleASupprimer));
        if (articleObj && articleObj.image) {
            await supprimerImageStorage(articleObj.image);
        }

        await mySupabase.from('produits').delete().eq('id', articleASupprimer).eq('vendeur', myWhatsapp);
        fermerConfirm();
        await chargerMesArticles(1);
        afficherAlerteCustom("Retiré", "L'article et sa photo ont été effacés de votre boutique.", "succes");
    } catch (err) {
        afficherAlerteCustom("Erreur", "Impossible de retirer cet article.", "erreur");
    } finally {
        btn.innerText = "Oui, Retirer";
        btn.disabled = false;
    }
});

document.getElementById('photoInput').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
        myPhoto = e.target.files[0];
        document.getElementById('btnPhotoText').innerText = "IMAGE PRÊTE ✅";
        document.getElementById('btnPhotoText').style.color = "#16a34a";
        document.getElementById('iconPhoto').style.color = "#16a34a";
    }
});

const modPhotoInputElt = document.getElementById('mod-photo-input');
if (modPhotoInputElt) {
    modPhotoInputElt.addEventListener('change', function(e) {
        if (e.target.files && e.target.files[0]) {
            modPhotoFile = e.target.files[0];
            const txt = document.getElementById('mod-photo-text');
            if (txt) txt.innerText = "Nouvelle photo prête ✅";
        }
    });
}

async function publierAnnonce() {
    if (monAbonnement === 'standard' && monNombreArticles >= 5) {
        afficherAlerteCustom("Limite atteinte", "Vous avez utilisé vos 5 emplacements gratuits. Passez PRO ou VIP pour un stock ILLIMITÉ.", "erreur");
        return;
    }

    const nomP = document.getElementById('pNom').value.trim();
    const prixP = document.getElementById('pPrix').value.trim();
    const catP = document.getElementById('pCat').value;
    const descP = document.getElementById('pDesc').value.trim();

    if (!nomP || !prixP) {
        afficherAlerteCustom("Attention", "Le nom et le prix sont obligatoires.", "erreur");
        return;
    }
    if (!myPhoto) {
        afficherAlerteCustom("Attention", "N'oubliez pas la photo de l'article.", "erreur");
        return;
    }

    const btn = document.getElementById('btnPublier');
    btn.innerText = "COMPRESSION...";
    btn.disabled = true;

    try {
        const optionsCompression = {
            maxSizeMB: 0.15,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
            fileType: 'image/webp'
        };

        const imageCompressee = await imageCompression(myPhoto, optionsCompression);

        btn.innerText = "ENVOI EN COURS...";
        const nomFichier = myUser.id + "_" + Date.now() + ".webp";

        const { error: errPhoto } = await mySupabase.storage.from('images').upload(nomFichier, imageCompressee);
        if (errPhoto) throw new Error("Erreur Photo : " + errPhoto.message);

        const { data: { publicUrl } } = mySupabase.storage.from('images').getPublicUrl(nomFichier);

        const { error: errProduit } = await mySupabase.from('produits').insert([{
            nom: nomP,
            prix: prixP,
            categorie: catP,
            description: descP,
            vendeur: myWhatsapp,
            image: publicUrl,
            statut: 'actif'
        }]);

        if (errProduit) throw new Error(errProduit.message);

        afficherAlerteCustom("MAGNIFIQUE !", "Votre article est en ligne et visible par tous.", "succes");
        setTimeout(() => { window.location.reload(); }, 1800);

    } catch (erreur) {
        afficherAlerteCustom("ÉCHEC", erreur.message, "erreur");
        btn.innerText = "Publier sur le marché";
        btn.disabled = false;
    }
}

function mettreAJourCompteurEtFormulaire(totalArticles) {
    monNombreArticles = totalArticles || 0;
    const limiteAffichage = (monAbonnement === 'standard') ? 5 : "Illimité";
    const compteurElt = document.getElementById('compteur-articles');
    if (compteurElt) compteurElt.innerText = monNombreArticles + " / " + limiteAffichage;

    const formElt = document.getElementById('formulaire-annonce');
    const msgLimiteElt = document.getElementById('message-limite');

    if (monAbonnement === 'standard' && monNombreArticles >= 5) {
        if (formElt) formElt.classList.add('hidden');
        if (msgLimiteElt) msgLimiteElt.classList.remove('hidden');
    } else {
        if (formElt) formElt.classList.remove('hidden');
        if (msgLimiteElt) msgLimiteElt.classList.add('hidden');
    }
}

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

    mettreAJourCompteurEtFormulaire(count || 0);

    if (error || !data || data.length === 0) {
        if (page === 1) {
            container.innerHTML = '<p class="text-gray-400 text-sm font-bold col-span-2 text-center py-4">Vous n\'avez aucun article en ligne.</p>';
        }
        document.getElementById('pagination-controls').classList.add('hidden');
        return;
    }

    window.mesArticlesLocaux = data;

    container.innerHTML = data.map(p => {
        const boostActif = p.est_booste === true && (!p.fin_boost || new Date(p.fin_boost) > new Date());
        let badgeStatut = '';
        if (p.statut === 'attente') {
            badgeStatut = `<span class="absolute top-1.5 left-1.5 bg-gray-800 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-md z-10">EN REVUE</span>`;
        } else if (p.statut === 'pause_abo') {
            badgeStatut = `<span class="absolute top-1.5 left-1.5 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-md z-10"><i class="fas fa-lock mr-1"></i>PAUSE ABO</span>`;
        } else if (p.statut === 'epuise') {
            badgeStatut = `<span class="absolute top-1.5 left-1.5 bg-gray-700 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-md z-10">ÉPUISÉ</span>`;
        } else if (boostActif) {
            badgeStatut = `<span class="absolute top-1.5 left-1.5 bg-[#f97316] text-white text-[8px] font-black px-2 py-0.5 rounded shadow-md z-10"><i class="fas fa-fire mr-1"></i>BOOST ACTIF</span>`;
        }

        const estEpuise = p.statut === 'epuise';
        const btnStockClass = estEpuise ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600";
        const btnStockIcon = estEpuise ? "fa-check" : "fa-pause";
        const btnBoostHtml = boostActif
            ? `<button onclick="demanderBoost('${p.id}')" class="flex-1 bg-green-100 text-green-700 rounded-lg text-[8px] font-black py-1"><i class="fas fa-fire"></i> ACTIF</button>`
            : `<button onclick="demanderBoost('${p.id}')" class="flex-1 bg-orange-100 text-orange-600 rounded-lg text-[9px] font-black py-1"><i class="fas fa-rocket"></i> BOOST</button>`;

        return `
        <div class="bg-white rounded-xl shadow-sm border ${boostActif ? 'border-orange-400' : 'border-gray-200'} overflow-hidden flex flex-col relative">
            ${badgeStatut}
            <img src="${p.image}" loading="lazy" class="w-full h-24 object-cover ${p.statut !== 'actif' ? 'opacity-50' : ''}">
            <div class="p-2 flex-1 flex flex-col">
                <h4 class="font-black text-[10px] text-gray-800 uppercase truncate mb-0.5">${echapperHTML(p.nom)}</h4>
                <span class="text-orange-500 font-black text-xs mb-2">${p.prix} F</span>
                <div class="flex gap-1 mt-auto">
                    <button onclick="demanderConfirmation('${p.id}')" title="Supprimer" class="w-8 bg-red-100 text-red-600 rounded-lg py-1 text-xs"><i class="fas fa-trash-alt"></i></button>
                    <button onclick="ouvrirModification('${p.id}')" title="Modifier" class="w-8 bg-blue-100 text-blue-600 rounded-lg py-1 text-xs"><i class="fas fa-edit"></i></button>
                    <button onclick="basculerStock('${p.id}', '${p.statut}')" title="Mettre en pause / Activer" class="w-8 ${btnStockClass} rounded-lg py-1 text-xs"><i class="fas ${btnStockIcon}"></i></button>
                    ${btnBoostHtml}
                </div>
            </div>
        </div>
        `;
    }).join('');

    mettreAJourPagination(count);
}

async function basculerStock(id, statutActuel) {
    if (statutActuel === 'pause_abo') {
        afficherAlerteCustom("Abonnement requis", "Cet article est en pause car votre compte est limité à 5 articles gratuits. Passez PRO ou VIP pour le réactiver.", "erreur");
        return;
    }
    const nouveauStatut = (statutActuel === 'actif') ? 'epuise' : 'actif';
    const { error } = await mySupabase.from('produits').update({ statut: nouveauStatut }).eq('id', id).eq('vendeur', myWhatsapp);
    if (!error) {
        chargerMesArticles(pageActuelle);
    }
}

function ouvrirModification(id) {
    const article = window.mesArticlesLocaux.find(a => String(a.id) === String(id));
    if (!article) return;

    modPhotoFile = null;
    const txtPhoto = document.getElementById('mod-photo-text');
    if (txtPhoto) txtPhoto.innerText = "Remplacer la photo (optionnel)";

    document.getElementById('mod-id').value = article.id;
    document.getElementById('mod-nom').value = article.nom;
    document.getElementById('mod-prix').value = article.prix;
    document.getElementById('mod-desc').value = article.description || "";
    const selectCat = document.getElementById('mod-cat');
    if (selectCat && article.categorie) selectCat.value = article.categorie;
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
    const nom = document.getElementById('mod-nom').value.trim();
    const prix = document.getElementById('mod-prix').value.trim();
    const cat = document.getElementById('mod-cat') ? document.getElementById('mod-cat').value : undefined;
    const desc = document.getElementById('mod-desc').value.trim();

    if (!nom || !prix) {
        afficherAlerteCustom("Attention", "Le nom et le prix sont obligatoires.", "erreur");
        return;
    }

    btn.innerText = "EN COURS...";
    btn.disabled = true;

    try {
        const champsMaj = { nom: nom, prix: prix, description: desc };
        if (cat) champsMaj.categorie = cat;

        if (modPhotoFile) {
            const optionsCompression = { maxSizeMB: 0.15, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/webp' };
            const imageCompressee = await imageCompression(modPhotoFile, optionsCompression);
            const nomFichier = myUser.id + "_mod_" + Date.now() + ".webp";

            const { error: errUpload } = await mySupabase.storage.from('images').upload(nomFichier, imageCompressee);
            if (errUpload) throw new Error("Erreur photo : " + errUpload.message);

            const { data: { publicUrl } } = mySupabase.storage.from('images').getPublicUrl(nomFichier);
            champsMaj.image = publicUrl;

            if (window.urlImageActuelle) {
                await supprimerImageStorage(window.urlImageActuelle);
            }
        }

        const { error } = await mySupabase
            .from('produits')
            .update(champsMaj)
            .eq('id', id)
            .eq('vendeur', myWhatsapp);

        if (error) throw new Error(error.message);

        afficherAlerteCustom("Super", "Votre article a été modifié.", "succes");
        fermerModification();
        chargerMesArticles(pageActuelle);

    } catch (erreur) {
        afficherAlerteCustom("Échec", "Erreur lors de la modification : " + erreur.message, "erreur");
    } finally {
        btn.innerText = "Sauver";
        btn.disabled = false;
    }
}

function mettreAJourPagination(total) {
    const controls = document.getElementById('pagination-controls');
    const totalPages = Math.max(1, Math.ceil(total / articlesParPage));

    if (total <= articlesParPage) {
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');
    controls.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.onclick = () => {
            chargerMesArticles(i);
            document.getElementById('mes-articles').scrollIntoView({ behavior: 'smooth' });
        };

        if (i === pageActuelle) {
            btn.className = "w-10 h-10 rounded-xl bg-[#5b21b6] text-white font-bold text-sm shadow-md flex items-center justify-center transition-all";
        } else {
            btn.className = "w-10 h-10 rounded-xl bg-white text-gray-700 font-bold text-sm shadow-sm border border-gray-200 flex items-center justify-center active:scale-95 transition-all";
        }
        controls.appendChild(btn);
    }

    if (pageActuelle < totalPages) {
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

function contacterAdminUpgrade() {
    const message = encodeURIComponent(`Bonjour Cœur de Marché, je suis le gérant de la boutique "${monNomBoutique}". Je souhaite passer au statut de VENDEUR VIP pour 2000F/mois et booster mes ventes.`);
    window.open(`https://wa.me/${NUMERO_ADMIN}?text=${message}`);
}

function contacterAdminPro() {
    const message = encodeURIComponent(`Bonjour Cœur de Marché, ma boutique "${monNomBoutique}" souhaite passer au forfait PRO pour publier en illimité.`);
    window.open(`https://wa.me/${NUMERO_ADMIN}?text=${message}`);
}

function demanderBoost(idOuNom) {
    const article = window.mesArticlesLocaux.find(a => String(a.id) === String(idOuNom));
    const nomArticle = article ? article.nom : idOuNom;
    const message = encodeURIComponent(`Bonjour Cœur de Marché, je suis la boutique "${monNomBoutique}". Je souhaite activer un BOOST pour mon article : ${nomArticle}`);
    window.open(`https://wa.me/${NUMERO_ADMIN}?text=${message}`);
}

function partagerMaBoutique() {
    if (!myWhatsapp) return;
    const baseUrl = window.location.href.replace(/bureau\.html.*$/, 'index.html');
    const lienMagique = baseUrl + '?boutique=' + encodeURIComponent(myWhatsapp);
    const message = `👋 Découvrez ma boutique *${monNomBoutique}* sur Cœur de Marché Bouaflé !\n\n🛒 Cliquez ici pour voir tous mes articles et commander :\n${lienMagique}`;

    if (navigator.share) {
        navigator.share({ title: monNomBoutique, text: message }).catch(() => {});
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
    }
}

function appelerLivreur() {
    const message = encodeURIComponent(`Bonjour Service Livraison Cœur de Marché (01 43 81 27 59), je suis la boutique "${monNomBoutique}" (WhatsApp : ${myWhatsapp}). J'ai besoin d'un livreur pour expédier un colis à Bouaflé.`);
    window.open(`https://wa.me/${NUMERO_LIVRAISON}?text=${message}`);
}

function envoyerCommandeLivreur(numeroCmd) {
    const cmd = window.mesCommandesLocales.find(c => String(c.numero_commande) === String(numeroCmd));
    const quartier = (cmd && cmd.quartier_livraison) ? cmd.quartier_livraison : "À préciser avec le client";
    const montant = cmd ? cmd.total_fcfa : "";
    const message = encodeURIComponent(`🛵 *DEMANDE DE LIVRAISON #CMD-${numeroCmd}*\n\n🏪 *Boutique :* ${monNomBoutique} (${myWhatsapp})\n📍 *Quartier client :* ${quartier}\n💰 *Montant commande :* ${montant} FCFA\n\nMerci de nous contacter pour récupérer le colis.`);
    window.open(`https://wa.me/${NUMERO_LIVRAISON}?text=${message}`);
}

async function chargerStatsEtCommandes() {
    if (!mySupabase || !myWhatsapp) return;
    try {
        const { count: nbVues } = await mySupabase
            .from('interactions_utilisateurs')
            .select('*', { count: 'exact', head: true })
            .eq('vendeur_tel', myWhatsapp)
            .eq('action', 'vue');

        const { count: nbPaniers } = await mySupabase
            .from('interactions_utilisateurs')
            .select('*', { count: 'exact', head: true })
            .eq('vendeur_tel', myWhatsapp)
            .eq('action', 'panier');

        const { data: commandesData, count: nbCmd } = await mySupabase
            .from('commandes')
            .select('*', { count: 'exact' })
            .eq('vendeur_tel', myWhatsapp)
            .order('numero_commande', { ascending: false })
            .limit(5);

        const elVues = document.getElementById('stat-vues');
        const elPaniers = document.getElementById('stat-paniers');
        const elCmd = document.getElementById('stat-commandes');

        if (elVues) elVues.innerText = nbVues || 0;
        if (elPaniers) elPaniers.innerText = nbPaniers || 0;
        if (elCmd) elCmd.innerText = nbCmd || 0;

        const conteneurCmd = document.getElementById('mes-commandes');
        if (!conteneurCmd) return;

        if (!commandesData || commandesData.length === 0) {
            conteneurCmd.innerHTML = '<p class="text-gray-400 text-xs font-bold text-center py-4 bg-white rounded-2xl border border-gray-100">Aucune commande enregistrée pour le moment.</p>';
            return;
        }

        window.mesCommandesLocales = commandesData;

        conteneurCmd.innerHTML = commandesData.map(c => {
            const itemsListe = Array.isArray(c.items)
                ? c.items.map(i => `${i.quantite || 1}x ${echapperHTML(i.nom)}`).join(', ')
                : 'Articles commandés';
            const estLivraison = c.mode_reception === 'livraison';
            const badgeReception = estLivraison
                ? `<span class="bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 rounded-full"><i class="fas fa-motorcycle mr-1"></i>Livraison : ${echapperHTML(c.quartier_livraison || 'Bouaflé')}</span>`
                : `<span class="bg-purple-100 text-[#5b21b6] text-[9px] font-black px-2 py-0.5 rounded-full"><i class="fas fa-store mr-1"></i>En boutique</span>`;

            return `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div class="flex justify-between items-center mb-1.5">
                    <span class="font-black text-xs text-[#4c1d95]">#CMD-${c.numero_commande}</span>
                    <span class="font-black text-xs text-orange-600">${c.total_fcfa} FCFA</span>
                </div>
                <p class="text-[11px] text-gray-600 font-bold mb-2">${itemsListe}</p>
                <div class="flex justify-between items-center pt-2 border-t border-gray-50">
                    ${badgeReception}
                    <button onclick="envoyerCommandeLivreur('${c.numero_commande}')" class="bg-[#25D366] text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition">
                        <i class="fas fa-motorcycle"></i> Livrer (01 43 81 27 59)
                    </button>
                </div>
            </div>
            `;
        }).join('');

    } catch (e) {
        console.log("Erreur chargement statistiques", e);
    }
}

async function deconnecter() {
    if (mySupabase) { await mySupabase.auth.signOut(); }
    window.location.href = "vendre.html";
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

        await supprimerImageStorage(window.urlImageActuelle);

        btnOpti.innerHTML = '<i class="fas fa-upload fa-bounce"></i> Envoi...';
        const { error: errPhoto } = await mySupabase.storage.from('images').upload(nomFichier, imageCompressee);
        if (errPhoto) throw new Error("Erreur d'envoi : " + errPhoto.message);

        const { data: { publicUrl } } = mySupabase.storage.from('images').getPublicUrl(nomFichier);

        btnOpti.innerHTML = '<i class="fas fa-database"></i> Mise à jour...';
        const { error: errDb } = await mySupabase
            .from('produits')
            .update({ image: publicUrl })
            .eq('id', id)
            .eq('vendeur', myWhatsapp);

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

async function demarrerBureau() {
    try {
        if (typeof window.supabase === 'undefined') return;

        mySupabase = window.supabase.createClient(dbUrl, dbKey);

        try {
            await mySupabase.rpc('verifier_expirations');
        } catch (e) {
            console.log("Vérification expirations ignorée", e);
        }

        const { data: { session } } = await mySupabase.auth.getSession();

        if (!session) {
            window.location.href = "vendre.html";
            return;
        }

        myUser = session.user;

        const { data: vendeur } = await mySupabase
            .from('vendeurs')
            .select('*')
            .eq('id', myUser.id)
            .single();

        if (vendeur) {
            monNomBoutique = vendeur.nom_boutique || "Boutique";
            document.getElementById('nom-boutique').innerText = monNomBoutique;
            document.getElementById('nom-vendeur').innerText = "Gérant : " + (vendeur.proprietaire || "Gérant");
            myWhatsapp = String(vendeur.whatsapp || '').trim();

            monAbonnement = vendeur.abonnement || 'standard';

            if (monAbonnement === 'pro' || monAbonnement === 'vip') {
                const badgePro = document.getElementById('badge-pro');
                if (badgePro) {
                    badgePro.innerText = monAbonnement.toUpperCase();
                    badgePro.classList.remove('hidden');
                }
                if (vendeur.fin_abonnement) {
                    const dateFin = new Date(vendeur.fin_abonnement);
                    const joursRestants = Math.max(0, Math.ceil((dateFin - new Date()) / (1000 * 60 * 60 * 24)));
                    const elFin = document.getElementById('date-fin-abo');
                    if (elFin) {
                        elFin.innerText = `Actif (${joursRestants} j restants)`;
                        elFin.classList.remove('hidden');
                    }
                }
            }

            const badge = document.getElementById('badge-abonnement');
            badge.innerText = monAbonnement;
            badge.classList.remove('hidden');
            badge.className = "text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm badge-" + monAbonnement;

            if (monAbonnement === 'standard') {
                document.getElementById('zone-upgrade').classList.remove('hidden');
            }

            await chargerMesArticles(1);
            await chargerStatsEtCommandes();
        }

    } catch (erreur) {
        console.log("Erreur de démarrage", erreur);
    }
}

demarrerBureau();

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
window.basculerStock = basculerStock;
window.partagerMaBoutique = partagerMaBoutique;
window.appelerLivreur = appelerLivreur;
window.envoyerCommandeLivreur = envoyerCommandeLivreur;
