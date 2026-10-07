let articles = [];
let panier = JSON.parse(localStorage.getItem('coeur_panier')) || [];

// --- Favoris (stockés sur le téléphone, comme le panier) ---
let favoris = (() => {
    try {
        const v = JSON.parse(localStorage.getItem('coeur_favoris'));
        return Array.isArray(v) ? v.map(String) : [];
    } catch (e) { return []; }
})();
const filtreFavoris = { boutique: false, rayon: false };
let minuteurFiltres = null;

function estFavori(id) { return favoris.includes(String(id)); }

function iconeCoeur(id) {
    return estFavori(id) ? 'fas fa-heart text-red-500' : 'far fa-heart text-gray-300';
}

function basculerFavori(id, event) {
    if (event) event.stopPropagation();
    id = String(id);
    if (estFavori(id)) {
        favoris = favoris.filter(f => f !== id);
        afficherToastPanier("Retiré des favoris");
    } else {
        favoris.push(id);
        afficherToastPanier("Ajouté aux favoris ❤️");
    }
    try { localStorage.setItem('coeur_favoris', JSON.stringify(favoris)); } catch (e) {}
    document.querySelectorAll('[data-fav-id]').forEach(btn => {
        if (btn.getAttribute('data-fav-id') === id) {
            const ic = btn.querySelector('i');
            if (ic) ic.className = iconeCoeur(id);
        }
    });
    // Si le filtre « Favoris » est actif, on retire tout de suite l'article de la liste
    if ((cibleCourante === 'liste-boutique' && filtreFavoris.boutique) ||
        (cibleCourante === 'liste-rayon' && filtreFavoris.rayon)) {
        afficherProduits(articlesCourants, cibleCourante, false);
    }
}

function appliquerFiltres(suffixe) {
    clearTimeout(minuteurFiltres);
    minuteurFiltres = setTimeout(() => {
        afficherProduits(articlesCourants, 'liste-' + suffixe);
    }, 250);
}

function basculerFiltreFavoris(suffixe) {
    filtreFavoris[suffixe] = !filtreFavoris[suffixe];
    const btn = document.getElementById('btn-fav-' + suffixe);
    if (btn) {
        btn.classList.toggle('bg-red-50', filtreFavoris[suffixe]);
        btn.classList.toggle('border-red-200', filtreFavoris[suffixe]);
        btn.classList.toggle('text-red-600', filtreFavoris[suffixe]);
        const i = btn.querySelector('i');
        if(i) i.className = filtreFavoris[suffixe] ? 'fas fa-heart text-red-500' : 'fas fa-heart text-gray-300';
    }
    afficherProduits(articlesCourants, 'liste-' + suffixe);
}
let articlesCourants = [];
let cibleCourante = '';
let pageCourante = 1;
const elementsParPage = 12;
const NUMERO_LIVRAISON = '2250143812759';
let modeReceptionChoisi = 'retrait';

let monSupabase;
let deviceId = localStorage.getItem('coeur_device_id');
if (!deviceId) {
    deviceId = 'tel_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('coeur_device_id', deviceId);
}

window.articlesParId = new Map();
window.vendeursMap = {};
window.nomsBoutiquesParTel = {};
window.tousVendeursListe = [];

let intervalCarrousel;
let timerToastPanier;

function formaterPrix(montant) {
    const n = parseInt(String(montant ?? '0').replace(/\s+/g, ''), 10);
    if (isNaN(n)) return montant;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function pousserHistorique() {
    if (window.history && window.history.pushState) {
        window.history.pushState({ cdmNav: true }, '');
    }
}

window.addEventListener('popstate', () => {
    const modalImg = document.getElementById('modal-image');
    if (modalImg && modalImg.style.display === 'flex') {
        fermerImage(true);
        return;
    }
    const modalAlerte = document.getElementById('modal-alerte');
    if (modalAlerte && modalAlerte.style.display === 'flex') {
        fermerAlerte(true);
        return;
    }
    const modalDetails = document.getElementById('modal-details');
    if (modalDetails && modalDetails.style.display === 'block') { // Corrigé pour le nouveau modal
        fermerModalDetails(true);
        return;
    }
    const modalPanier = document.getElementById('modal-panier');
    if (modalPanier && modalPanier.style.display === 'flex') {
        fermerPanier(true);
        return;
    }
    const modalAide = document.getElementById('modal-aide');
    if (modalAide && modalAide.style.display === 'flex') {
        fermerAide(true);
        return;
    }
    const vueRayon = document.getElementById('vue-rayon');
    if (vueRayon && !vueRayon.classList.contains('hidden')) {
        changerVue('boutique', true);
        return;
    }
    const vueBoutique = document.getElementById('vue-boutique');
    if (vueBoutique && !vueBoutique.classList.contains('hidden')) {
        changerVue('accueil', true);
        return;
    }
});

function mettreAJourBadgePanier() {
    const badgeNav = document.getElementById('panier-count-nav');
    if (!badgeNav) return;
    const totalArticles = panier.reduce((acc, item) => acc + (parseInt(item.quantite) || 1), 0);
    badgeNav.innerText = totalArticles;
}
mettreAJourBadgePanier();

function afficherToastPanier(texte = "Ajouté au panier !") {
    const toast = document.getElementById('toast-panier');
    if (!toast) return;
    toast.innerHTML = `<i class="fas fa-check-circle mr-1"></i> ${texte}`;
    toast.classList.add('show');
    clearTimeout(timerToastPanier);
    timerToastPanier = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function afficherAlerteCustom(titre, message) {
    document.getElementById('alerte-titre').innerText = titre;
    document.getElementById('alerte-message').innerText = message;
    const modal = document.getElementById('modal-alerte');
    modal.style.display = 'flex';
    pousserHistorique();
    setTimeout(() => modal.classList.add('active'), 10);
}

function fermerAlerte(depuisRetour = false) {
    const modal = document.getElementById('modal-alerte');
    if (!modal || modal.style.display === 'none') return;
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function ouvrirImage(url) {
    const imgElt = document.getElementById('image-en-grand');
    imgElt.src = url;
    const modal = document.getElementById('modal-image');
    modal.style.display = 'flex';
    pousserHistorique();
    setTimeout(() => {
        modal.classList.add('active');
        imgElt.classList.remove('scale-95');
        imgElt.classList.add('scale-100');
    }, 10);
}

function fermerImage(depuisRetour = false) {
    const modal = document.getElementById('modal-image');
    if (!modal || modal.style.display === 'none') return;
    const imgElt = document.getElementById('image-en-grand');
    modal.classList.remove('active');
    imgElt.classList.remove('scale-100');
    imgElt.classList.add('scale-95');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function demarrerCarrouselAuto() {
    const carrousel = document.getElementById('carrousel-vip');
    if (!carrousel || carrousel.children.length <= 1) return;
    clearInterval(intervalCarrousel);
    intervalCarrousel = setInterval(() => {
        const maxScroll = carrousel.scrollWidth - carrousel.clientWidth;
        if (carrousel.scrollLeft >= maxScroll - 10) {
            carrousel.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            const itemWidth = carrousel.children[0].clientWidth + 12;
            carrousel.scrollBy({ left: itemWidth, behavior: 'smooth' });
        }
    }, 3000);
    }

function extraireYoutubeId(url) {
    let id = String(url || '');
    const match = id.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (match && match[1]) id = match[1];
    return id;
}

function echapperHTML(texte) {
    const div = document.createElement('div');
    div.textContent = String(texte ?? '');
    return div.innerHTML;
}

function normaliserTexte(texte) {
    return String(texte || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function boostEstActif(produit) {
    if (!produit || produit.est_booste !== true) return false;
    if (produit.fin_boost && new Date(produit.fin_boost) < new Date()) return false;
    return true;
}

function trouverArticle(idOuNom) {
    if (idOuNom === undefined || idOuNom === null) return null;
    const cle = String(idOuNom);
    if (window.articlesParId.has(cle)) return window.articlesParId.get(cle);
    return articles.find(a => String(a.id) === cle || a.nom === cle) || null;
}

async function init() {
    const ecranLoad = document.getElementById('ecran-chargement');
    try {
        const dbUrl = "https://szhxxohizqnwcmsltjtq.supabase.co";
        const dbKey = "sb_publishable_hfQrBZ4OYrkHjUxvtzCL_g_mi05THSO";
        monSupabase = window.supabase.createClient(dbUrl, dbKey);

        monSupabase.rpc('verifier_expirations').then(() => {}).catch(e => {
            console.log("Vérification expirations ignorée", e);
        });

        const [
            { data: produitsData },
            { data: pubData },
            { data: tvData },
            { data: annonceData },
            { data: tousVendeurs }
        ] = await Promise.all([
            monSupabase.from('produits').select('*').eq('statut', 'actif').order('dateajout', { ascending: true, nullsFirst: true }),
            monSupabase.from('publicites').select('image, statut, id_produit').eq('statut', 'actif'),
            monSupabase.from('tv_market').select('*').eq('statut', 'actif').limit(1).maybeSingle(),
            monSupabase.from('annonces').select('message').limit(1).maybeSingle(),
            monSupabase.from('vendeurs').select('id, nom_boutique, whatsapp, abonnement, fin_abonnement, image, photo_couverture, logo')
        ]);

        if (produitsData) {
            articles = produitsData;
            window.articlesParId = new Map(articles.map(a => [String(a.id), a]));
        }

        // VOTRE CODE TV ET BANNIÈRES INTACT
        const conteneurVIP = document.getElementById('carrousel-vip');
        if (pubData && pubData.length > 0) {
            conteneurVIP.innerHTML = pubData.map(p => {
                const articleLie = p.id_produit ? trouverArticle(p.id_produit) : null;
                if (articleLie) {
                    return `<div class="vip-banner relative overflow-hidden rounded-lg shadow-sm border border-gray-200 shrink-0" style="min-width: 85vw;" onclick="ouvrirDetails('${articleLie.id}')"><img src="${p.image}" class="w-full h-32 object-cover"><div class="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">Voir le produit</div></div>`;
                } else {
                    return `<img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="vip-banner h-32 rounded-lg shadow-sm border border-gray-200 object-cover">`;
                }
            }).join('');
            setTimeout(demarrerCarrouselAuto, 1000);
        }

        const conteneurTV = document.getElementById('conteneur-tv');
        if (tvData && tvData.lien_youtube) {
            const articleTV = tvData.id_produit ? trouverArticle(tvData.id_produit) : null;
            let boutonAction = "";
            if (articleTV) {
                boutonAction = `<button onclick="ouvrirDetails('${articleTV.id}')" class="mt-3 w-full bg-[#f97316] text-white font-bold py-2 rounded-md text-sm shadow-sm active:bg-orange-600 transition">Acheter ce produit</button>`;
            }
            const youtubeIdNettoye = extraireYoutubeId(tvData.lien_youtube);
            conteneurTV.innerHTML = `<div class="bg-white p-2 rounded-lg border border-gray-200 shadow-sm"><div class="video-container rounded-md overflow-hidden"><iframe src="https://www.youtube.com/embed/${youtubeIdNettoye}" frameborder="0" allowfullscreen></iframe></div>${boutonAction}</div>`;
        }

        if (annonceData) document.getElementById('texte-annonce').innerText = annonceData.message;

        const produitRecherche = new URLSearchParams(window.location.search).get('produit');
        if (produitRecherche) setTimeout(() => { ouvrirDetails(produitRecherche); }, 500);

        window.vendeursMap = {};
        window.nomsBoutiquesParTel = {};
        window.tousVendeursListe = tousVendeurs || [];

        if (tousVendeurs) {
            tousVendeurs.forEach(v => {
                const telNet = String(v.whatsapp || '').trim();
                window.vendeursMap[v.id] = telNet;
                if (telNet) {
                    window.nomsBoutiquesParTel[telNet] = v.nom_boutique || 'Boutique';
                }
            });
        }

        const maintenant = new Date();
        const vendeursVip = (tousVendeurs || []).filter(v => {
            if (v.abonnement !== 'vip') return false;
            if (v.fin_abonnement && new Date(v.fin_abonnement) < maintenant) return false;
            return true;
        });

        const conteneurBoutiques = document.getElementById('avenue-boutiques-vip');

        if (conteneurBoutiques && vendeursVip.length > 0) {
            conteneurBoutiques.innerHTML = vendeursVip.map(v => {
                const nomBoutique = v.nom_boutique || 'Boutique Officielle';
                const initiale = nomBoutique.substring(0, 1).toUpperCase();
                const imageCouverture = v.image || v.photo_couverture || v.logo || '';
                const bgStyle = (imageCouverture && imageCouverture !== 'null' && imageCouverture !== '')
                    ? "background-image: url('" + imageCouverture + "'); background-size: cover; background-position: center;"
                    : "background: linear-gradient(to right, #4c1d95, #7c3aed);";

                return `
                <div onclick="filtrerVIP('${v.id}', '${echapperHTML(nomBoutique).replace(/'/g, "\\'")}', '${imageCouverture}')"
                     style="${bgStyle}"
                     class="min-w-[150px] h-20 rounded-lg shadow-sm p-3 flex flex-col justify-center relative overflow-hidden shrink-0 border border-gray-200">
                    <div class="absolute inset-0 bg-black/50"></div>
                    <div class="flex items-center gap-2 relative z-10">
                        <div class="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 border border-white/30">
                            ${initiale}
                        </div>
                        <div>
                            <h3 class="text-white font-bold text-xs uppercase leading-tight truncate w-24">${echapperHTML(nomBoutique)}</h3>
                            <span class="text-yellow-300 text-[8px] font-bold uppercase tracking-widest"><i class="fas fa-star mr-1"></i> VIP</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }

        const boutiqueRecherche = new URLSearchParams(window.location.search).get('boutique');
        if (boutiqueRecherche) {
            setTimeout(() => {
                const vendeurTrouve = window.tousVendeursListe.find(v => String(v.id) === String(boutiqueRecherche) || String(v.whatsapp) === String(boutiqueRecherche));
                const nomPourBanniere = vendeurTrouve ? vendeurTrouve.nom_boutique : "Boutique";
                const imagePourBanniere = vendeurTrouve ? (vendeurTrouve.image || vendeurTrouve.photo_couverture || vendeurTrouve.logo || '') : '';
                filtrerVIP(boutiqueRecherche, nomPourBanniere, imagePourBanniere);
            }, 800);
        }

        if (vendeursVip.length > 0) {
            const numerosVIP = vendeursVip.map(v => String(v.whatsapp));
            const articlesVIP = articles.filter(a => numerosVIP.includes(String(a.vendeur)));
            const selectionVIP = articlesVIP.sort(() => 0.5 - Math.random()).slice(0, 6);
            if (selectionVIP.length > 0) {
                afficherNouveautes(selectionVIP, 'liste-nouveautes');
            } else {
                afficherNouveautes([...articles].reverse().slice(0, 6), 'liste-nouveautes');
            }
        } else {
            afficherNouveautes([...articles].reverse().slice(0, 6), 'liste-nouveautes');
        }

    } catch (err) {
        document.getElementById('texte-annonce').innerText = "Erreur de connexion.";
    } finally {
        if (ecranLoad) {
            ecranLoad.style.opacity = '0';
            setTimeout(() => { ecranLoad.style.display = 'none'; }, 300);
        }
    }
                    }

function filtrerVIP(idVendeur, nomBoutique, imageCouverture = '') {
    pousserHistorique();
    const telVendeur = window.vendeursMap[idVendeur] || idVendeur || '';
    const vendeurObj = window.tousVendeursListe.find(v => String(v.id) === String(idVendeur) || String(v.whatsapp) === String(telVendeur));
    
    const nomAffiche = nomBoutique || (vendeurObj ? vendeurObj.nom_boutique : "Boutique");
    const estVip = vendeurObj && vendeurObj.abonnement === 'vip';
    const texteStatut = estVip ? '~ Boutique Officielle' : '~ Boutique Partenaire';

    // 1. Définir l'image de couverture (Rectangle du haut)
    let coverUrl = imageCouverture;
    if (!coverUrl && vendeurObj) {
        coverUrl = vendeurObj.photo_couverture || vendeurObj.image || '';
    }

    // 2. Définir le Logo (Cercle central)
    let logoUrl = vendeurObj ? vendeurObj.logo : '';
    let initiale = (nomAffiche || 'B')[0].toUpperCase();
    let logoHtml = logoUrl 
        ? `<img src="${logoUrl}" class="w-full h-full object-cover">` 
        : `${initiale}`;

    const zoneBanniere = document.getElementById('banniere-vendeur');
    if (zoneBanniere) {
        const styleFond = (coverUrl && coverUrl !== 'null' && coverUrl !== 'undefined' && coverUrl !== '')
            ? `background-image: url('${coverUrl}'); background-size: cover; background-position: center;`
            : `background: linear-gradient(to right, #4c1d95, #7c3aed);`;

        // LE DESIGN "WHATSAPP BUSINESS"
        zoneBanniere.innerHTML = `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm mb-6 overflow-hidden">
            <!-- Couverture -->
            <div style="${styleFond}" class="w-full h-32 relative">
                <div class="absolute inset-0 bg-black/10"></div>
                <button onclick="partagerBoutique('${telVendeur}', '${echapperHTML(nomAffiche).replace(/'/g, "\\'")}')"
                        class="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white w-8 h-8 rounded-full flex items-center justify-center z-20 transition active:scale-95">
                    <i class="fas fa-share-alt text-sm"></i>
                </button>
            </div>

            <!-- Profil (Logo superposé au centre) -->
            <div class="relative flex justify-center mt-[-40px]">
                <div class="w-20 h-20 bg-white rounded-full p-1 shadow-sm">
                    <div class="w-full h-full bg-gray-50 rounded-full flex items-center justify-center text-[#5b21b6] font-black text-3xl overflow-hidden border border-gray-100">
                        ${logoHtml}
                    </div>
                </div>
            </div>

            <!-- Informations (Centrées en dessous) -->
            <div class="text-center px-4 pb-5 pt-2">
                <div class="flex items-center justify-center gap-1.5 mb-0.5">
                    <h2 class="text-xl font-bold text-gray-900 leading-tight">${echapperHTML(nomAffiche)}</h2>
                    ${estVip ? '<i class="fas fa-check-circle text-[#25D366] text-base" title="Compte Vérifié"></i>' : ''}
                </div>
                <p class="text-[13px] text-gray-500 font-medium">${texteStatut}</p>
                
                ${estVip ? '<div class="mt-3 flex justify-center"><span class="bg-yellow-50 border border-yellow-200 text-yellow-700 text-[9px] font-black px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1 shadow-sm"><i class="fas fa-crown"></i> Vendeur VIP</span></div>' : ''}
            </div>
        </div>
        `;
    }

    document.getElementById('inputRecherche').value = nomAffiche;
    const resultats = articles.filter(a => String(a.vendeur) === String(telVendeur));

    document.getElementById('vue-accueil').classList.add('hidden');
    document.getElementById('vue-rayon').classList.add('hidden');
    document.getElementById('vue-boutique').classList.remove('hidden');

    document.getElementById('nav-accueil').classList.remove('active-nav');
    document.getElementById('nav-boutique').classList.add('active-nav');
    document.getElementById('menu-rayons').classList.add('hidden');
    
    afficherProduits(resultats, 'liste-boutique');

    setTimeout(() => {
        const listeElt = document.getElementById('liste-boutique');
        if (listeElt) listeElt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// -------------------------------------------------------------
// DESIGN CARTES (STYLE JUMIA) ET CORRECTION NOMS
// -------------------------------------------------------------
function afficherNouveautes(liste, target) {
    const container = document.getElementById(target);
    if (!container) return;
    if (liste.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-[10px] italic">Aucune nouveauté</p>';
        return;
    }
    container.innerHTML = liste.map(p => {
        const nomBoutique = window.nomsBoutiquesParTel[String(p.vendeur || '').trim()] || 'Boutique';
        return `
        <div class="scroll-item bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col active:bg-gray-50 transition shadow-sm" onclick="ouvrirDetails('${p.id}')">
            <img src="${p.image}" loading="lazy" class="w-full h-28 object-cover bg-gray-50">
            <div class="p-2 flex flex-col flex-1">
                <h3 class="text-[11px] text-gray-700 font-medium line-clamp-2 leading-tight mb-1">${echapperHTML(p.nom)}</h3>
                <p class="text-sm font-black text-gray-900 mt-auto">${formaterPrix(p.prix)} F</p>
                <p class="text-[9px] text-gray-400 mt-0.5 truncate">${echapperHTML(nomBoutique)}</p>
            </div>
        </div>`;
    }).join('');
}

function afficherProduits(liste, target, resetPage = true) {
    articlesCourants = liste;
    cibleCourante = target;
    const container = document.getElementById(target);
    if (!container) return;

    if (resetPage) pageCourante = 1;

    let listeTriee = [...liste];
    let critereTri = 'recent';

    const suffixeFiltre = target === 'liste-boutique' ? 'boutique' : (target === 'liste-rayon' ? 'rayon' : null);
    if (suffixeFiltre) {
        const elMin = document.getElementById('prix-min-' + suffixeFiltre);
        const elMax = document.getElementById('prix-max-' + suffixeFiltre);
        const prixMin = elMin ? parseInt(elMin.value, 10) : NaN;
        const prixMax = elMax ? parseInt(elMax.value, 10) : NaN;
        const seulementFavoris = filtreFavoris[suffixeFiltre];
        listeTriee = listeTriee.filter(p => {
            const prix = parseInt(p.prix, 10) || 0;
            if (!isNaN(prixMin) && prix < prixMin) return false;
            if (!isNaN(prixMax) && prix > prixMax) return false;
            if (seulementFavoris && !estFavori(p.id)) return false;
            return true;
        });
    }

    if (target === 'liste-boutique') critereTri = document.getElementById('tri-prix-boutique').value;
    if (target === 'liste-rayon') critereTri = document.getElementById('tri-prix-rayon').value;

    if (critereTri === 'croissant') {
        listeTriee.sort((a, b) => parseInt(a.prix) - parseInt(b.prix));
    } else if (critereTri === 'decroissant') {
        listeTriee.sort((a, b) => parseInt(b.prix) - parseInt(a.prix));
    } else {
        listeTriee.reverse();
    }

    listeTriee.sort((a, b) => {
        const aBoost = boostEstActif(a);
        const bBoost = boostEstActif(b);
        if (aBoost && !bBoost) return -1;
        if (bBoost && !aBoost) return 1;
        return 0;
    });

    const totalPages = Math.ceil(listeTriee.length / elementsParPage);
    if (pageCourante > totalPages && totalPages > 0) pageCourante = totalPages;

    const debut = (pageCourante - 1) * elementsParPage;
    const fin = debut + elementsParPage;
    let listeFinale = listeTriee.slice(debut, fin);

    if (listeFinale.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1;" class="text-center py-8 text-gray-400 text-sm">Aucun produit trouvé.</div>`;
        return;
    }

    container.innerHTML = listeFinale.map(p => {
        const estSponsorise = boostEstActif(p);
        const designCarte = estSponsorise ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200';
        const badgeSponsor = estSponsorise ? '<div class="absolute top-0 left-0 bg-[#f97316] text-white text-[9px] font-bold px-1.5 py-0.5 z-10 rounded-br">Sponsorisé</div>' : '';
        const nomBoutique = window.nomsBoutiquesParTel[String(p.vendeur || '').trim()] || 'Boutique';

        return `
        <div class="relative rounded-md border ${designCarte} shadow-sm overflow-hidden flex flex-col active:border-purple-300 transition" onclick="ouvrirDetails('${p.id}')">
            <div class="relative w-full h-36 bg-gray-50">
                ${badgeSponsor}
                <img src="${p.image}" loading="lazy" class="w-full h-full object-cover">
                <button data-fav-id="${p.id}" onclick="basculerFavori('${p.id}', event)" class="absolute bottom-2 right-2 z-20 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center border border-gray-100"><i class="${iconeCoeur(p.id)} text-sm"></i></button>
            </div>
            <div class="p-2 flex flex-col flex-grow">
                <h1 class="font-medium text-[11px] text-gray-700 mb-1 leading-snug line-clamp-2">${echapperHTML(p.nom)}</h1>
                <div class="mt-auto">
                    <p class="font-black text-sm text-gray-900">${formaterPrix(p.prix)} F</p>
                    <p class="text-[9px] text-gray-400 mt-0.5 truncate">${echapperHTML(nomBoutique)}</p>
                </div>
            </div>
        </div>
        `;
    }).join('');

    if (listeTriee.length > elementsParPage) {
        let paginationHtml = `<div style="grid-column: 1 / -1;" class="flex justify-center items-center gap-2 mt-6 mb-8 flex-wrap">`;
        if (pageCourante > 1) {
            paginationHtml += `<button onclick="allerPage(${pageCourante - 1})" class="bg-white border border-gray-300 text-gray-700 font-bold text-xs px-3.5 py-2 rounded-md shadow-sm">Précédent</button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
            if (i === pageCourante) {
                paginationHtml += `<span class="bg-[#5b21b6] text-white font-bold text-xs px-3.5 py-2 rounded-md shadow-sm">${i}</span>`;
            } else {
                paginationHtml += `<button onclick="allerPage(${i})" class="bg-white border border-gray-300 text-gray-700 font-bold text-xs px-3.5 py-2 rounded-md shadow-sm">${i}</button>`;
            }
        }
        if (pageCourante < totalPages) {
            paginationHtml += `<button onclick="allerPage(${pageCourante + 1})" class="bg-white border border-gray-300 text-gray-700 font-bold text-xs px-3.5 py-2 rounded-md shadow-sm">Suivant</button>`;
        }
        paginationHtml += `</div>`;
        container.innerHTML += paginationHtml;
    }
}

function allerPage(numPage) {
    pageCourante = numPage;
    afficherProduits(articlesCourants, cibleCourante, false);
    const container = document.getElementById(cibleCourante);
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function changerTriBoutique() { afficherProduits(articlesCourants, 'liste-boutique'); }
function changerTriRayon() { afficherProduits(articlesCourants, 'liste-rayon'); }

async function enregistrerInteraction(article, typeAction) {
    if (!monSupabase || !article) return;
    if (typeAction === 'vue') {
        const cleVue = 'cdm_vue_' + String(article.id);
        if (sessionStorage.getItem(cleVue)) return;
        sessionStorage.setItem(cleVue, '1');
    }
    try {
        await monSupabase.from('interactions_utilisateurs').insert([
            {
                device_id: deviceId,
                article_nom: article.nom,
                id_produit: String(article.id),
                vendeur_tel: String(article.vendeur || ''),
                action: typeAction
            }
        ]);
    } catch (error) {
        console.log("Erreur silencieuse", error);
    }
}

// -------------------------------------------------------------
// NOUVELLE FICHE PRODUIT PLEIN ÉCRAN
// -------------------------------------------------------------
function ouvrirDetails(idOuNom) {
    const p = trouverArticle(idOuNom);
    if (!p) return;
    enregistrerInteraction(p, 'vue');
    const link = window.location.href.split('?')[0] + '?produit=' + encodeURIComponent(p.id);
    const nomBoutique = window.nomsBoutiquesParTel[String(p.vendeur || '').trim()] || 'Boutique';

    window.messagePartage = `🌟 ${p.nom} - ${formaterPrix(p.prix)} FCFA sur Cœur de Marché Bouaflé.\nVoir ici : ${link}`;

    const similaires = articles.filter(a => a.categorie === p.categorie && String(a.id) !== String(p.id)).sort(()=>0.5-Math.random()).slice(0, 4);
    let htmlSim = '';
    if(similaires.length > 0) {
        htmlSim = `<div class="mt-8 pt-6 border-t border-gray-100">
            <h3 class="font-bold text-gray-800 text-sm mb-4">Dans le même rayon</h3>
            <div class="grid grid-cols-2 gap-3">
                ${similaires.map(sim => `
                <div class="bg-white border border-gray-200 rounded-md overflow-hidden active:bg-gray-50 shadow-sm" onclick="ouvrirDetails('${sim.id}')">
                    <img src="${sim.image}" class="w-full h-28 object-cover bg-gray-50">
                    <div class="p-2"><p class="text-[11px] text-gray-700 font-medium line-clamp-2 leading-tight">${echapperHTML(sim.nom)}</p><p class="text-sm font-black text-gray-900 mt-1">${formaterPrix(sim.prix)} F</p></div>
                </div>`).join('')}
            </div>
        </div>`;
    }

    document.getElementById('details-contenu').innerHTML = `
        <div class="sticky top-0 bg-white z-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between shadow-sm">
            <button onclick="fermerModalDetails()" class="w-8 h-8 flex items-center justify-center text-gray-600 bg-gray-100 rounded-full active:bg-gray-200"><i class="fas fa-arrow-left"></i></button>
            <span class="font-medium text-gray-800 text-sm truncate px-4 text-center">Détails de l'article</span>
            <button onclick="partager()" class="w-8 h-8 flex items-center justify-center text-gray-600 bg-gray-100 rounded-full active:bg-gray-200"><i class="fas fa-share-alt"></i></button>
        </div>
        
        <div class="w-full bg-gray-50 aspect-square">
            <img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="w-full h-full object-contain active:scale-95 transition-transform">
        </div>
        
        <div class="p-4">
            <h1 class="text-lg text-gray-800 font-medium leading-snug mb-2">${echapperHTML(p.nom)}</h1>
            <p class="text-2xl font-black text-gray-900 mb-6">${formaterPrix(p.prix)} FCFA</p>
            
            <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 p-3 rounded-lg mb-6 shadow-sm active:bg-gray-100 transition" onclick="fermerModalDetails(); setTimeout(() => filtrerVIP('${p.vendeur}'), 300);">
                <div class="w-10 h-10 bg-white rounded-full border border-gray-200 flex items-center justify-center text-[#5b21b6]"><i class="fas fa-store"></i></div>
                <div>
                    <p class="text-[10px] text-gray-500 font-medium uppercase">Vendu par</p>
                    <p class="text-sm font-bold text-gray-900">${echapperHTML(nomBoutique)}</p>
                </div>
                <i class="fas fa-chevron-right ml-auto text-gray-400 text-xs"></i>
            </div>

            <div class="mb-4">
                <h3 class="font-bold text-gray-800 text-sm mb-2">Description du produit</h3>
                <div class="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">${p.description ? echapperHTML(p.description) : 'Cet article ne possède pas de description détaillée.'}</div>
            </div>
            ${htmlSim}
        </div>
        
        <div class="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-3 flex gap-3 z-50 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
            <button data-fav-id="${p.id}" onclick="basculerFavori('${p.id}', event)" class="w-12 flex items-center justify-center border border-gray-300 rounded-md text-xl active:bg-gray-50"><i class="${iconeCoeur(p.id)}"></i></button>
            <button onclick="ajouterAuPanier('${p.id}')" class="flex-1 bg-[#f97316] text-white font-bold text-sm rounded-md shadow-sm active:bg-orange-600 transition-colors">Ajouter au panier</button>
        </div>
    `;

    const modal = document.getElementById('modal-details');
    modal.style.display = 'block';
    pousserHistorique();
    setTimeout(() => modal.classList.add('active'), 10);
    modal.scrollTop = 0; // Remonter la fiche tout en haut
}

function fermerModalDetails(depuisRetour = false) {
    const modal = document.getElementById('modal-details');
    if (!modal || modal.style.display === 'none') return;
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function choisirModeReception(mode) {
    modeReceptionChoisi = mode;
    const btnRetrait = document.getElementById('btn-mode-retrait');
    const btnLivraison = document.getElementById('btn-mode-livraison');
    const zoneQuartier = document.getElementById('zone-quartier-livraison');

    if (!btnRetrait || !btnLivraison || !zoneQuartier) return;

    if (mode === 'livraison') {
        btnLivraison.className = "py-2 px-2 rounded border border-[#f97316] bg-[#f97316] text-white text-xs font-bold transition";
        btnRetrait.className = "py-2 px-2 rounded border border-gray-300 bg-white text-gray-600 text-xs font-medium transition";
        zoneQuartier.classList.remove('hidden');
    } else {
        btnRetrait.className = "py-2 px-2 rounded border border-[#f97316] bg-[#f97316] text-white text-xs font-bold transition";
        btnLivraison.className = "py-2 px-2 rounded border border-gray-300 bg-white text-gray-600 text-xs font-medium transition";
        zoneQuartier.classList.add('hidden');
    }
}

function ajouterAuPanier(idOuNom, prixFallback, telFallback) {
    const article = trouverArticle(idOuNom);
    const idProd = article ? String(article.id) : String(idOuNom);
    const nom = article ? article.nom : String(idOuNom);
    const prix = article ? parseInt(article.prix) : parseInt(prixFallback || 0);
    const tel = String((article ? article.vendeur : telFallback) || '').trim();

    if (!tel) {
        afficherAlerteCustom("Indisponible", "Le contact de ce vendeur est introuvable.");
        return;
    }

    const existant = panier.find(item =>
        (item.id && String(item.id) === idProd) ||
        (!item.id && item.nom === nom && String(item.tel) === tel)
    );

    if (existant) {
        existant.quantite = (parseInt(existant.quantite) || 1) + 1;
        existant.id = idProd;
    } else {
        panier.push({ id: idProd, nom: nom, prix: prix, tel: tel, quantite: 1 });
    }

    localStorage.setItem('coeur_panier', JSON.stringify(panier));
    mettreAJourBadgePanier();
    afficherToastPanier();
    if (article) enregistrerInteraction(article, 'panier');
}

function modifierQuantitePanier(index, delta) {
    if (!panier[index]) return;
    const nouvelleQte = (parseInt(panier[index].quantite) || 1) + delta;
    if (nouvelleQte <= 0) {
        panier.splice(index, 1);
    } else {
        panier[index].quantite = nouvelleQte;
    }
    localStorage.setItem('coeur_panier', JSON.stringify(panier));
    mettreAJourBadgePanier();
    ouvrirPanier(true);
}

function ouvrirPanier(estRafraichissement = false) {
    const container = document.getElementById('panier-liste');
    const totalElt = document.getElementById('panier-total');
    const modal = document.getElementById('modal-panier');

    if (!estRafraichissement && modal.style.display !== 'flex') {
        pousserHistorique();
    }

    if (panier.length === 0) {
        container.innerHTML = '<p class="text-center py-8 font-medium text-gray-400 text-sm">Votre panier est vide</p>';
        if (totalElt) totalElt.innerText = "0 FCFA";
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        return;
    }

    let totalGlobal = 0;
    const vendeurs = {};

    panier.forEach((p, index) => {
        const qte = parseInt(p.quantite) || 1;
        totalGlobal += (parseInt(p.prix) || 0) * qte;
        const tel = String(p.tel || '').trim();
        if (!tel) return;
        if (!vendeurs[tel]) vendeurs[tel] = [];
        vendeurs[tel].push({ ...p, quantite: qte, index });
    });

    if (totalElt) totalElt.innerText = formaterPrix(totalGlobal) + " FCFA";

    container.innerHTML = Object.keys(vendeurs).map(tel => {
        const items = vendeurs[tel];
        let sousTotal = 0;
        const nomBoutique = window.nomsBoutiquesParTel[tel] || tel;

        const htmlItems = items.map(i => {
            const totalLigne = (parseInt(i.prix) || 0) * i.quantite;
            sousTotal += totalLigne;
            return `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-md mb-2 border border-gray-100">
                <div class="flex-1 pr-2 overflow-hidden">
                    <p class="font-medium text-xs text-gray-800 truncate">${echapperHTML(i.nom)}</p>
                    <p class="text-gray-900 font-bold text-sm">${formaterPrix(i.prix)} F <span class="text-xs text-gray-400 font-normal">x${i.quantite}</span></p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <div class="flex items-center bg-white border border-gray-200 rounded">
                        <button onclick="modifierQuantitePanier(${i.index}, -1)" class="w-7 h-7 text-gray-600 flex items-center justify-center active:bg-gray-100">-</button>
                        <span class="text-xs font-bold w-5 text-center">${i.quantite}</span>
                        <button onclick="modifierQuantitePanier(${i.index}, 1)" class="w-7 h-7 text-gray-600 flex items-center justify-center active:bg-gray-100">+</button>
                    </div>
                    <button onclick="retirerDuPanier(${i.index})" class="w-8 h-8 text-red-400 bg-red-50 rounded flex items-center justify-center ml-1"><i class="fas fa-trash-alt text-xs"></i></button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="bg-white rounded-lg p-3 border border-gray-200 mb-4 shadow-sm">
            <div class="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                <p class="font-bold text-gray-800 text-xs"><i class="fas fa-store text-gray-400 mr-1"></i> ${echapperHTML(nomBoutique)}</p>
                <span class="text-xs font-bold text-[#f97316]">${formaterPrix(sousTotal)} F</span>
            </div>
            <div class="mb-3">${htmlItems}</div>
            <button onclick="validerCommande('${tel}', '${tel}')" class="w-full bg-[#25D366] text-white font-bold py-2.5 rounded-md text-xs flex items-center justify-center gap-2 active:bg-green-600 transition">
                <i class="fab fa-whatsapp text-lg"></i> Commander ces articles
            </button>
        </div>`;
    }).join('');

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function retirerDuPanier(index) {
    panier.splice(index, 1);
    localStorage.setItem('coeur_panier', JSON.stringify(panier));
    mettreAJourBadgePanier();
    ouvrirPanier(true);
}

async function validerCommande(telWhatsApp, telVendeur) {
    const champQuartier = document.getElementById('quartier-livraison');
    const quartier = champQuartier ? champQuartier.value.trim() : '';

    if (modeReceptionChoisi === 'livraison' && !quartier) {
        afficherAlerteCustom("Quartier requis", "Veuillez indiquer votre quartier ou lieu de livraison à Bouaflé.");
        return;
    }

    const ecranLoad = document.getElementById('ecran-chargement');
    if (ecranLoad) { ecranLoad.style.display = 'flex'; ecranLoad.style.opacity = '1'; }

    try {
        const articlesVendeur = panier.filter(p => String(p.tel).trim() === String(telVendeur).trim());
        if (articlesVendeur.length === 0) return;

        let vraiTotal = 0;
        const itemsPourBase = [];
        let detailTexte = "";

        articlesVendeur.forEach(p => {
            const qte = parseInt(p.quantite) || 1;
            const articleReel = (p.id ? trouverArticle(p.id) : null) || articles.find(a => a.nom === p.nom && String(a.vendeur).trim() === String(p.tel).trim());
            const prixUnitaire = articleReel ? parseInt(articleReel.prix) : parseInt(p.prix);
            const nomArticle = articleReel ? articleReel.nom : p.nom;
            const idArticle = articleReel ? articleReel.id : (p.id || null);

            const sousTotal = prixUnitaire * qte;
            vraiTotal += sousTotal;
            itemsPourBase.push({ id_produit: idArticle, prix: prixUnitaire, nom: nomArticle, quantite: qte });
            detailTexte += `- ${qte}x ${nomArticle} (${formaterPrix(sousTotal)} F)\n`;
        });

        const { data, error } = await monSupabase
            .from('commandes')
            .insert([{
                device_id: deviceId,
                vendeur_tel: String(telVendeur),
                total_fcfa: vraiTotal,
                items: itemsPourBase,
                mode_reception: modeReceptionChoisi,
                quartier_livraison: modeReceptionChoisi === 'livraison' ? quartier : null
            }])
            .select();

        if (error) throw error;

        const numeroCmd = data[0].numero_commande;
        const codeAffiche = "CMD-" + numeroCmd;

        let infoReception = "🏪 *Réception :* Retrait en boutique";
        if (modeReceptionChoisi === 'livraison') {
            infoReception = `🛵 *Réception :* LIVRAISON À DOMICILE\n📍 *Quartier / Lieu :* ${quartier}\n📞 *Service Livraison Cœur de Marché :* https://wa.me/${NUMERO_LIVRAISON}`;
        }

        const messageFinal = `🛒 *NOUVELLE COMMANDE #${codeAffiche}*\n\nDétails :\n${detailTexte}\n*TOTAL : ${formaterPrix(vraiTotal)} FCFA*\n\n${infoReception}\n\n_Cette commande est sécurisée dans le système._`;
        const msgEncoded = encodeURIComponent(messageFinal);

        panier = panier.filter(p => String(p.tel).trim() !== String(telVendeur).trim());
        localStorage.setItem('coeur_panier', JSON.stringify(panier));

        mettreAJourBadgePanier();
        if (panier.length === 0) fermerPanier(true); else ouvrirPanier(true);

        let numeroWa = String(window.vendeursMap[telVendeur] || telWhatsApp).replace(/\s+/g, '').replace('+', '');
        if (numeroWa.length === 10) {
            numeroWa = '225' + numeroWa;
        }
        window.open('https://wa.me/' + numeroWa + '?text=' + msgEncoded);

    } catch (err) {
        console.error("Erreur lors de la commande :", err);
        afficherAlerteCustom("Erreur réseau", "Une erreur est survenue lors de la création de la commande. Vérifiez votre connexion internet.");
    } finally {
        if (ecranLoad) { ecranLoad.style.opacity = '0'; setTimeout(() => ecranLoad.style.display = 'none', 300); }
    }
}

function fermerPanier(depuisRetour = false) {
    const modal = document.getElementById('modal-panier');
    if (!modal || modal.style.display === 'none') return;
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function ouvrirAide() {
    const modal = document.getElementById('modal-aide');
    modal.style.display = 'flex';
    pousserHistorique();
    setTimeout(() => modal.classList.add('active'), 10);
}

function fermerAide(depuisRetour = false) {
    const modal = document.getElementById('modal-aide');
    if (!modal || modal.style.display === 'none') return;
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function changerVue(v, depuisRetour = false) {
    if (!depuisRetour && v !== 'accueil') {
        pousserHistorique();
    }

    document.getElementById('inputRecherche').value = '';

    document.getElementById('vue-accueil').classList.add('hidden');
    document.getElementById('vue-boutique').classList.add('hidden');
    document.getElementById('vue-rayon').classList.add('hidden');

    document.getElementById('vue-' + v).classList.remove('hidden');

    document.getElementById('nav-accueil').classList.remove('active-nav');
    document.getElementById('nav-boutique').classList.remove('active-nav');

    if (document.getElementById('nav-' + v)) {
        document.getElementById('nav-' + v).classList.add('active-nav');
    }

    if (v === 'accueil') {
        const sectionVip = document.getElementById('section-boutiques-vip');
        if (sectionVip) sectionVip.classList.remove('hidden');
    }

    if (v === 'boutique') {
        const menu = document.getElementById('menu-rayons');
        if (menu) menu.classList.remove('hidden');

        const banniere = document.getElementById('banniere-vendeur');
        if (banniere) banniere.innerHTML = '';

        afficherProduits(articles, 'liste-boutique');
    }
    window.scrollTo(0, 0);
}

function filtrerAccueil(c) {
    document.getElementById('titre-rayon').innerText = c;
    const cNorm = normaliserTexte(c);
    const f = articles.filter(a => normaliserTexte(a.categorie).includes(cNorm));
    afficherProduits(f, 'liste-rayon');
    changerVue('rayon');
}

function filtrerBoutique(cat) {
    document.getElementById('titre-rayon').innerText = cat;
    const catNorm = normaliserTexte(cat);
    const filtered = articles.filter(a => normaliserTexte(a.categorie) === catNorm);
    afficherProduits(filtered, 'liste-rayon');
    changerVue('rayon');
}

function lancerMicro() {
    const iconMicro = document.getElementById('iconMicro');
    const inputRecherche = document.getElementById('inputRecherche');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        afficherAlerteCustom('Désolé', 'Votre navigateur ne supporte pas la recherche vocale.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;

    recognition.onstart = function() {
        iconMicro.classList.remove('fa-microphone');
        iconMicro.classList.add('fa-microphone-slash', 'text-red-500');
    };

    recognition.onresult = function(event) {
        const texteCompris = event.results[0][0].transcript;
        inputRecherche.value = texteCompris;
        rechercherProduit({ key: 'Enter' });
    };

    recognition.onerror = function() {
        afficherAlerteCustom('Erreur', 'Je n\'ai pas bien entendu. Réessayez.');
    };

    recognition.onend = function() {
        iconMicro.classList.add('fa-microphone');
        iconMicro.classList.remove('fa-microphone-slash', 'text-red-500');
    };

    recognition.start();
}

function rechercherProduit(event) {
    const s = normaliserTexte(document.getElementById('inputRecherche').value);
    if (!s) {
        changerVue('boutique', true);
        return;
    }

    const filtered = articles.filter(a =>
        normaliserTexte(a.nom).includes(s) ||
        normaliserTexte(a.description).includes(s) ||
        normaliserTexte(a.categorie).includes(s)
    );

    let target = 'liste-boutique';
    if (!document.getElementById('vue-rayon').classList.contains('hidden')) {
        target = 'liste-rayon';
    } else if (!document.getElementById('vue-accueil').classList.contains('hidden')) {
        document.getElementById('vue-accueil').classList.add('hidden');
        document.getElementById('vue-boutique').classList.remove('hidden');
        document.getElementById('nav-accueil').classList.remove('active-nav');
        document.getElementById('nav-boutique').classList.add('active-nav');
    }

    afficherProduits(filtered, target);
    
       const menuRayons = document.getElementById('menu-rayons');
    if (menuRayons) menuRayons.classList.add('hidden');

    if (event && event.key === 'Enter') {
        document.getElementById('inputRecherche').blur();
    }
}

function partagerBoutique(tel, nom) {
    const baseUrl = window.location.href.split('?')[0];
    const lienMagique = baseUrl + '?boutique=' + tel;
    const message = "👋 Visitez la boutique *" + nom + "* sur Cœur de Marché Bouaflé !\n\n🛒 Voir les articles : \n" + lienMagique;

    if (navigator.share) {
        navigator.share({
            title: nom + ' - Cœur de Marché',
            text: message
        }).catch(err => console.log("Partage annulé", err));
    } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(message));
    }
}

function partager() {
    if (navigator.share) {
        navigator.share({ text: window.messagePartage });
    } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(window.messagePartage));
    }
}

function remonterHaut() { window.scrollTo({ top: 0, behavior: "smooth" }); }
window.addEventListener('scroll', () => {
    const btn = document.getElementById('btn-remonter');
    if (window.scrollY > 300) btn.classList.add('show');
    else btn.classList.remove('show');
});

init();
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
    }
            
