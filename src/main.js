let articles = [];
let panier = JSON.parse(localStorage.getItem('coeur_panier')) || [];
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
    setTimeout(() => modal.classList.add('active'), 10);
}

function fermerAlerte() {
    const modal = document.getElementById('modal-alerte');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function ouvrirImage(url) {
    const imgElt = document.getElementById('image-en-grand');
    imgElt.src = url;
    const modal = document.getElementById('modal-image');
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
        imgElt.classList.remove('scale-95');
        imgElt.classList.add('scale-100');
    }, 10);
}

function fermerImage() {
    const modal = document.getElementById('modal-image');
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

        try {
            await monSupabase.rpc('verifier_expirations');
        } catch (e) {
            console.log("Vérification expirations ignorée", e);
        }

        const { data: produitsData } = await monSupabase.from('produits').select('*').eq('statut', 'actif');

        if (produitsData) {
            articles = produitsData;
            window.articlesParId = new Map(articles.map(a => [String(a.id), a]));
        }

        const { data: pubData } = await monSupabase.from('publicites').select('image, statut, id_produit').eq('statut', 'actif');
        const conteneurVIP = document.getElementById('carrousel-vip');

        if (pubData && pubData.length > 0) {
            conteneurVIP.innerHTML = pubData.map(p => {
                const articleLie = p.id_produit ? trouverArticle(p.id_produit) : null;
                if (articleLie) {
                    return `<div class="vip-banner relative overflow-hidden rounded-[15px] shadow-sm border border-gray-100 shrink-0" style="min-width: 85vw;" onclick="ouvrirDetails('${articleLie.id}')"><img src="${p.image}" class="w-full h-32 object-cover"><div class="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg backdrop-blur-sm">Voir le produit</div></div>`;
                } else {
                    return `<img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="vip-banner h-32 shadow-sm border border-gray-100">`;
                }
            }).join('');
            setTimeout(demarrerCarrouselAuto, 1000);
        }

        const { data: tvData } = await monSupabase.from('tv_market').select('*').eq('statut', 'actif').limit(1).single();
        const conteneurTV = document.getElementById('conteneur-tv');
        if (tvData && tvData.lien_youtube) {
            const articleTV = tvData.id_produit ? trouverArticle(tvData.id_produit) : null;
            let boutonAction = "";
            if (articleTV) {
                boutonAction = `<button onclick="ouvrirDetails('${articleTV.id}')" class="mt-3 w-full bg-[#5b21b6] text-white font-black py-2 rounded-xl text-xs uppercase shadow-md active:scale-95 transition">Acheter ce produit</button>`;
            }
            const youtubeIdNettoye = extraireYoutubeId(tvData.lien_youtube);
            conteneurTV.innerHTML = `<div class="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100"><div class="video-container rounded-[15px] overflow-hidden"><iframe src="https://www.youtube.com/embed/${youtubeIdNettoye}" frameborder="0" allowfullscreen></iframe></div>${boutonAction}</div>`;
        }

        const { data: annonceData } = await monSupabase.from('annonces').select('message').limit(1).single();
        if (annonceData) document.getElementById('texte-annonce').innerText = annonceData.message;

        const produitRecherche = new URLSearchParams(window.location.search).get('produit');
        if (produitRecherche) setTimeout(() => { ouvrirDetails(produitRecherche); }, 500);

        const { data: tousVendeurs } = await monSupabase.from("vendeurs").select("*");
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
                     class="min-w-[220px] h-24 rounded-2xl shadow-md p-4 flex flex-col justify-center relative overflow-hidden shrink-0">
                    <div class="absolute inset-0 bg-black/60"></div>
                    <i class="fas fa-store absolute -right-4 -bottom-4 text-white opacity-10 text-6xl z-0"></i>
                    <div class="flex items-center gap-3 relative z-10">
                        <div class="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-black text-xl shrink-0 shadow-sm border border-white/30">
                            ${initiale}
                        </div>
                        <div>
                            <h3 class="text-white font-black text-sm uppercase leading-tight truncate w-32">${echapperHTML(nomBoutique)}</h3>
                            <span class="text-yellow-300 text-[9px] font-black uppercase tracking-widest"><i class="fas fa-star mr-1"></i> VIP</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

            setInterval(() => {
                if (conteneurBoutiques.scrollLeft >= conteneurBoutiques.scrollWidth - conteneurBoutiques.clientWidth) {
                    conteneurBoutiques.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    conteneurBoutiques.scrollBy({ left: 70, behavior: 'smooth' });
                }
            }, 3500);
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
                afficherNouveautes(articles.slice(0, 6), 'liste-nouveautes');
            }
        } else {
            afficherNouveautes(articles.slice(0, 6), 'liste-nouveautes');
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
    const telVendeur = window.vendeursMap[idVendeur] || idVendeur || '';
    const vendeurObj = window.tousVendeursListe.find(v => String(v.id) === String(idVendeur) || String(v.whatsapp) === String(telVendeur));
    const estVip = vendeurObj && vendeurObj.abonnement === 'vip';
    const texteStatut = estVip ? 'Boutique Officielle VIP' : 'Boutique Partenaire';

    const zoneBanniere = document.getElementById('banniere-vendeur');
    if (zoneBanniere) {
        const styleFond = (imageCouverture && imageCouverture !== 'null' && imageCouverture !== 'undefined' && imageCouverture !== '')
            ? "background-image: url('" + imageCouverture + "'); background-size: cover; background-position: center;"
            : "background: linear-gradient(to right, #4c1d95, #7c3aed);";

        zoneBanniere.innerHTML = `
        <div style="${styleFond}" class="w-full h-48 rounded-[20px] shadow-md relative overflow-hidden shrink-0 mb-4">
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
            <button onclick="partagerBoutique('${telVendeur}', '${echapperHTML(nomBoutique).replace(/'/g, "\\'")}')"
                    class="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm z-20 border border-white/20">
                <i class="fas fa-share-nodes text-lg"></i>
            </button>
            <div class="absolute bottom-4 left-4 right-4 z-10 flex flex-col justify-end">
                <div class="flex items-center gap-1.5 mb-1">
                    <i class="fas fa-crown text-yellow-400 text-[11px] drop-shadow-md"></i>
                    <p class="text-yellow-400 text-[10px] font-black uppercase tracking-widest drop-shadow-md">${texteStatut}</p>
                </div>
                <h2 class="text-white text-2xl font-black uppercase leading-tight drop-shadow-lg">${echapperHTML(nomBoutique)}</h2>
            </div>
        </div>
        `;
    }

    document.getElementById('inputRecherche').value = nomBoutique;
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

function afficherNouveautes(liste, target) {
    const container = document.getElementById(target);
    if (!container) return;
    if (liste.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-[10px] italic">Aucune nouveauté</p>';
        return;
    }
    container.innerHTML = liste.map(p => `
        <div class="scroll-item bg-white rounded-[15px] shadow-sm overflow-hidden flex flex-col relative border border-gray-50 active:scale-95 transition">
            <div class="price-badge" style="font-size:10px; padding:3px 8px; top:8px; right:8px;">${p.prix} F</div>
            <img src="${p.image}" loading="lazy" onclick="ouvrirDetails('${p.id}')" class="w-full h-24 object-cover">
            <div class="px-2 py-2 flex-1 flex flex-col text-center">
                <h3 class="font-black text-[#4c1d95] text-[9px] uppercase truncate mb-2">${echapperHTML(p.nom)}</h3>
                <button onclick="ajouterAuPanier('${p.id}')" class="w-full bg-[#f8f9fd] text-[#5b21b6] font-black py-2 rounded-xl text-[9px] uppercase border border-gray-100 active:bg-gray-100">Ajouter</button>
            </div>
        </div>
    `).join('');
}

function afficherProduits(liste, target, resetPage = true) {
    articlesCourants = liste;
    cibleCourante = target;
    const container = document.getElementById(target);
    if (!container) return;

    if (resetPage) pageCourante = 1;

    let listeTriee = [...liste];
    let critereTri = 'recent';

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
        container.innerHTML = `<div style="grid-column: 1 / -1;" class="text-center py-8 text-gray-400">Aucun produit trouvé.</div>`;
        return;
    }

    container.innerHTML = listeFinale.map(p => {
        const estSponsorise = boostEstActif(p);
        const designCarte = estSponsorise ? 'bg-orange-50 border-2 border-[#f97316]' : 'bg-white border-gray-100';
        const badgeSponsor = estSponsorise ? '<div class="absolute top-0 left-0 bg-[#f97316] text-white text-[9px] font-black px-2 py-1 rounded-br-lg z-20 shadow-md"><i class="fas fa-fire mr-1"></i>SPONSORISÉ</div>' : '';

        return `
        <div class="relative rounded-[20px] shadow-sm overflow-hidden flex flex-col ${designCarte}">
            <div class="relative w-full h-40 bg-gray-100">
                ${badgeSponsor}
                <img src="${p.image}" loading="lazy" onclick="ouvrirImage('${p.image}')" class="w-full h-full object-cover">
                <div class="price-badge"><small>FCFA</small></div>
            </div>
            <div class="p-3 flex flex-col flex-grow">
                <h1 class="font-black text-[12px] text-[#5b21b6] mb-1 uppercase leading-tight line-clamp-2">${echapperHTML(p.nom)}</h1>
                <div class="mt-auto flex gap-2">
                    <button onclick="ouvrirDetails('${p.id}')" class="flex-1 bg-gray-100 text-[#5b21b6] py-2.5 rounded-xl text-[10px] font-black uppercase">
                        ${p.prix} F
                    </button>
                    <button onclick="ajouterAuPanier('${p.id}')" class="w-10 h-10 bg-[#5b21b6] text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform">
                        <i class="fas fa-shopping-basket"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    if (listeTriee.length > elementsParPage) {
        let paginationHtml = `<div style="grid-column: 1 / -1;" class="flex justify-center items-center gap-2 mt-6 mb-8 flex-wrap">`;

        if (pageCourante > 1) {
            paginationHtml += `<button onclick="allerPage(${pageCourante - 1})" class="bg-white border-2 border-[#5b21b6] text-[#5b21b6] font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition">Précédent</button>`;
        }

        for (let i = 1; i <= totalPages; i++) {
            if (i === pageCourante) {
                paginationHtml += `<span class="bg-[#5b21b6] text-white font-black text-xs px-4 py-2 rounded-xl shadow-md">${i}</span>`;
            } else {
                paginationHtml += `<button onclick="allerPage(${i})" class="bg-white border border-gray-300 text-gray-700 font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition">${i}</button>`;
            }
        }

        if (pageCourante < totalPages) {
            paginationHtml += `<button onclick="allerPage(${pageCourante + 1})" class="bg-white border-2 border-[#5b21b6] text-[#5b21b6] font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition">Suivant</button>`;
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

function ouvrirDetails(idOuNom) {
    const p = trouverArticle(idOuNom);
    if (!p) return;
    enregistrerInteraction(p, 'vue');
    const link = window.location.href.split('?')[0] + '?produit=' + encodeURIComponent(p.id);
    const nomBoutique = window.nomsBoutiquesParTel[String(p.vendeur || '').trim()] || '';

    window.messagePartage = `🌟 *${p.nom}* (${p.prix} F)\nVoir ici : ${link}`;

    document.getElementById('details-contenu').innerHTML = `
        <img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="w-full h-64 object-cover rounded-xl mb-4 shadow-sm active:scale-95 transition transform">
        <div class="flex justify-between items-center">
            <h3 class="font-black text-xl text-[#4c1d95]">${echapperHTML(p.nom)}</h3>
            <span class="text-orange-500 font-black text-lg">${p.prix} F</span>
        </div>
        ${nomBoutique ? `<p class="text-[10px] font-black uppercase text-gray-400 mt-1"><i class="fas fa-store mr-1 text-orange-400"></i> ${echapperHTML(nomBoutique)}</p>` : ''}
        <div class="text-gray-600 text-sm mt-2 mb-6 overflow-y-auto" style="max-height: 200px;">
            ${p.description ? echapperHTML(p.description) : 'Aucun détail supplémentaire.'}
        </div>
        <div class="flex gap-2">
            <button onclick="ajouterAuPanier('${p.id}')" class="flex-1 bg-[#5b21b6] text-white font-black py-3 rounded-xl uppercase text-sm shadow-md transition transform active:scale-95">Ajouter au panier</button>
            <button onclick="partager()" class="w-14 bg-blue-500 text-white rounded-xl flex items-center justify-center text-xl shadow-md transition transform active:scale-95"><i class="fas fa-share-alt"></i></button>
        </div>
    `;

    const modal = document.getElementById('modal-details');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function partager() {
    if (navigator.share) {
        navigator.share({ text: window.messagePartage });
    } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(window.messagePartage));
    }
}

function choisirModeReception(mode) {
    modeReceptionChoisi = mode;
    const btnRetrait = document.getElementById('btn-mode-retrait');
    const btnLivraison = document.getElementById('btn-mode-livraison');
    const zoneQuartier = document.getElementById('zone-quartier-livraison');

    if (!btnRetrait || !btnLivraison || !zoneQuartier) return;

    if (mode === 'livraison') {
        btnLivraison.className = "py-2.5 px-3 rounded-xl font-black text-[10px] uppercase bg-[#f97316] text-white shadow-sm transition";
        btnRetrait.className = "py-2.5 px-3 rounded-xl font-black text-[10px] uppercase bg-white text-gray-600 border border-gray-200 transition";
        zoneQuartier.classList.remove('hidden');
    } else {
        btnRetrait.className = "py-2.5 px-3 rounded-xl font-black text-[10px] uppercase bg-[#5b21b6] text-white shadow-sm transition";
        btnLivraison.className = "py-2.5 px-3 rounded-xl font-black text-[10px] uppercase bg-white text-gray-600 border border-gray-200 transition";
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
    ouvrirPanier();
}

function ouvrirPanier() {
    const container = document.getElementById('panier-liste');
    const totalElt = document.getElementById('panier-total');

    if (panier.length === 0) {
        container.innerHTML = '<p class="text-center py-6 font-bold text-gray-400">Panier vide</p>';
        if (totalElt) totalElt.innerText = "0 FCFA";
        const modal = document.getElementById('modal-panier');
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

    if (totalElt) totalElt.innerText = totalGlobal + " FCFA";

    container.innerHTML = Object.keys(vendeurs).map(tel => {
        const items = vendeurs[tel];
        let sousTotal = 0;
        const nomBoutique = window.nomsBoutiquesParTel[tel] || tel;

        const htmlItems = items.map(i => {
            const totalLigne = (parseInt(i.prix) || 0) * i.quantite;
            sousTotal += totalLigne;
            return `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                <div class="flex-1 pr-2 overflow-hidden">
                    <p class="font-black text-[10px] text-gray-800 uppercase truncate">${echapperHTML(i.nom)}</p>
                    <p class="text-orange-500 font-bold text-xs">${i.prix} F x ${i.quantite} = ${totalLigne} F</p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="modifierQuantitePanier(${i.index}, -1)" class="w-7 h-7 bg-white border border-gray-200 text-gray-700 font-black rounded-lg flex items-center justify-center active:scale-90">-</button>
                    <span class="text-xs font-black w-5 text-center">${i.quantite}</span>
                    <button onclick="modifierQuantitePanier(${i.index}, 1)" class="w-7 h-7 bg-white border border-gray-200 text-gray-700 font-black rounded-lg flex items-center justify-center active:scale-90">+</button>
                    <button onclick="retirerDuPanier(${i.index})" class="w-7 h-7 bg-red-100 text-red-500 rounded-lg flex items-center justify-center active:scale-90 ml-1"><i class="fas fa-trash-alt text-xs"></i></button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm">
            <div class="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <p class="font-black text-[#5b21b6] text-[10px] uppercase"><i class="fas fa-store mr-1"></i> Boutique : ${echapperHTML(nomBoutique)}</p>
                <span class="text-[10px] font-black text-orange-600">${sousTotal} F</span>
            </div>
            <div class="space-y-2 mb-4">${htmlItems}</div>
            <button onclick="validerCommande('${tel}', '${tel}')" class="w-full bg-[#25D366] text-white font-black py-3 rounded-xl uppercase text-[10px] flex items-center justify-center gap-2 active:scale-95 transition">
                <i class="fab fa-whatsapp text-lg"></i> Commander ces articles
            </button>
        </div>`;
    }).join('');

    const modal = document.getElementById('modal-panier');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function retirerDuPanier(index) {
    panier.splice(index, 1);
    localStorage.setItem('coeur_panier', JSON.stringify(panier));
    mettreAJourBadgePanier();
    ouvrirPanier();
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
            detailTexte += `- ${qte}x ${nomArticle} (${sousTotal} F)\n`;
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

        const messageFinal = `🛒 *NOUVELLE COMMANDE #${codeAffiche}*\n\nDétails :\n${detailTexte}\n*TOTAL : ${vraiTotal} FCFA*\n\n${infoReception}\n\n_Cette commande est sécurisée dans le système._`;
        const msgEncoded = encodeURIComponent(messageFinal);

        panier = panier.filter(p => String(p.tel).trim() !== String(telVendeur).trim());
        localStorage.setItem('coeur_panier', JSON.stringify(panier));

        mettreAJourBadgePanier();
        if (panier.length === 0) fermerPanier(); else ouvrirPanier();

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

function fermerModalDetails() { const modal = document.getElementById('modal-details'); modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
function fermerPanier() { const modal = document.getElementById('modal-panier'); modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
function ouvrirAide() { const modal = document.getElementById('modal-aide'); modal.style.display = 'flex'; setTimeout(() => modal.classList.add('active'), 10); }
function fermerAide() { const modal = document.getElementById('modal-aide'); modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }

function changerVue(v) {
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
        changerVue('boutique');
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
    const message = "👋 Visitez ma boutique *" + nom + "* sur Cœur de Marché Bouaflé !\n\n🛒 Cliquez sur ce lien pour voir tous mes articles : \n" + lienMagique;

    if (navigator.share) {
        navigator.share({
            title: nom + ' - Cœur de Marché',
            text: message
        }).catch(err => console.log("Partage annulé", err));
    } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(message));
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
        
