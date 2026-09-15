let articles = [];
let panier = JSON.parse(localStorage.getItem('coeur_panier')) || [];
let articlesCourants = [];
let cibleCourante = '';
let pageCourante = 1;
const elementsParPage = 12;

let monSupabase;
let deviceId = localStorage.getItem('coeur_device_id');
if (!deviceId) {
    deviceId = 'tel_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('coeur_device_id', deviceId);
}

// Mettre à jour le compteur du nouveau panier central au démarrage
if (panier.length > 0) {
    const badgeNav = document.getElementById('panier-count-nav');
    if (badgeNav) badgeNav.innerText = panier.length;
}

let intervalCarrousel;

function afficherAlerteCustom(titre, message) { document.getElementById('alerte-titre').innerText = titre; document.getElementById('alerte-message').innerText = message; const modal = document.getElementById('modal-alerte'); modal.style.display = 'flex'; setTimeout(() => modal.classList.add('active'), 10); }
function fermerAlerte() { const modal = document.getElementById('modal-alerte'); modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }

function ouvrirImage(url) { const imgElt = document.getElementById('image-en-grand'); imgElt.src = url; const modal = document.getElementById('modal-image'); modal.style.display = 'flex'; setTimeout(() => { modal.classList.add('active'); imgElt.classList.remove('scale-95'); imgElt.classList.add('scale-100'); }, 10); }
function fermerImage() { const modal = document.getElementById('modal-image'); const imgElt = document.getElementById('image-en-grand'); modal.classList.remove('active'); imgElt.classList.remove('scale-100'); imgElt.classList.add('scale-95'); setTimeout(() => { modal.style.display = 'none'; }, 300); }

function demarrerCarrouselAuto() {
    const carrousel = document.getElementById('carrousel-vip');
    if (!carrousel || carrousel.children.length <= 1) return;
    clearInterval(intervalCarrousel);
    intervalCarrousel = setInterval(() => {
        const maxScroll = carrousel.scrollWidth - carrousel.clientWidth;
        if (carrousel.scrollLeft >= maxScroll - 10) { carrousel.scrollTo({ left: 0, behavior: 'smooth' }); }
        else { const itemWidth = carrousel.children[0].clientWidth + 12; carrousel.scrollBy({ left: itemWidth, behavior: 'smooth' }); }
    }, 3000);
}

function extraireYoutubeId(url) {
    let id = url;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (match && match[1]) id = match[1];
    return id;
}

function echapperHTML(texte) {
    const div = document.createElement('div');
    div.textContent = String(texte ?? '');
    return div.innerHTML;
}

async function init() {
    const ecranLoad = document.getElementById('ecran-chargement');
    try {
        // --- CORRECTION CLÉS SUPABASE ICI ---
        const dbUrl = "VOTRE_VRAIE_URL_SUPABASE";
        const dbKey = "VOTRE_VRAIE_CLE_ANON_SUPABASE";
        // ------------------------------------
        
        monSupabase = window.supabase.createClient(dbUrl, dbKey);

        const { data: produitsData } = await monSupabase.from('produits').select('*').eq('statut', 'actif');

        if (produitsData) {
            articles = produitsData;
            window.articlesParId = new Map(articles.map(a => [a.id, a]));
        }

        const { data: pubData } = await monSupabase.from('publicites').select('image, statut, id_produit').eq('statut', 'actif');
        const conteneurVIP = document.getElementById('carrousel-vip');

        if (pubData && pubData.length > 0) {
            conteneurVIP.innerHTML = pubData.map(p => {
                const articleLie = p.id_produit ? articles.find(a => a.id == p.id_produit) : null;
                if (articleLie) {
                    return `<div class="vip-banner relative overflow-hidden rounded-[15px] shadow-sm border border-gray-100 shrink-0" style="min-width: 85vw;" onclick="ouvrirDetails('${echapperHTML(articleLie.nom).replace(/'/g, "\\'")}')"><img src="${p.image}" class="w-full h-32 object-cover"><div class="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg backdrop-blur-sm">Voir le produit</div></div>`;
                } else {
                    return `<img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="vip-banner h-32 shadow-sm border border-gray-100">`;
                }
            }).join('');
            setTimeout(demarrerCarrouselAuto, 1000);
        }

        const { data: tvData } = await monSupabase.from('tv_market').select('*').eq('statut', 'actif').limit(1).single();
        const conteneurTV = document.getElementById('conteneur-tv');
        if (tvData && tvData.lien_youtube) {
            const articleTV = tvData.id_produit ? articles.find(a => a.id == tvData.id_produit) : null;
            let boutonAction = "";
            if (articleTV) { boutonAction = `<button onclick="ouvrirDetails('${echapperHTML(articleTV.nom).replace(/'/g, "\\'")}')" class="mt-3 w-full bg-[#5b21b6] text-white font-black py-2 rounded-xl text-xs uppercase shadow-md active:scale-95 transition">Acheter ce produit</button>`; }
            const youtubeIdNettoye = extraireYoutubeId(tvData.lien_youtube);
            conteneurTV.innerHTML = `<div class="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100"><div class="video-container rounded-[15px] overflow-hidden"><iframe src="https://www.youtube.com/embed/${youtubeIdNettoye}" frameborder="0" allowfullscreen></iframe></div>${boutonAction}</div>`;
        }

        const { data: annonceData } = await monSupabase.from('annonces').select('message').limit(1).single();
        if (annonceData) document.getElementById('texte-annonce').innerText = annonceData.message;

        const produitRecherche = new URLSearchParams(window.location.search).get('produit');
        if (produitRecherche) setTimeout(() => { ouvrirDetails(produitRecherche); }, 500);

        // --- 1. CHARGEMENT DES VENDEURS VIP ---
        const { data: vendeursVip } = await monSupabase.from('vendeurs').select('*').eq('abonnement', 'vip');
        const { data: tousVendeurs } = await monSupabase.from("vendeurs").select("id, whatsapp");
        window.vendeursMap = {};
        if (tousVendeurs) {
            tousVendeurs.forEach(v => {
                window.vendeursMap[v.id] = v.whatsapp;
            });
        }

        const conteneurBoutiques = document.getElementById('avenue-boutiques-vip');

        if (conteneurBoutiques && vendeursVip && vendeursVip.length > 0) {
            conteneurBoutiques.innerHTML = vendeursVip.map(v => {
                const nomBoutique = v.nom_boutique || 'Boutique Officielle';
                const initiale = nomBoutique.substring(0, 1).toUpperCase();
                const telVendeur = v.whatsapp || v.telephone || v.numero || '';
                const imageCouverture = v.image || v.photo_couverture || v.logo || '';
                const bgStyle = (imageCouverture && imageCouverture !== 'null' && imageCouverture !== '')
                    ? "background-image: url('" + imageCouverture + "'); background-size: cover; background-position: center;"
                    : "background: linear-gradient(to right, #4c1d95, #7c3aed);";

                return `
                <div onclick=\"filtrerVIP('${v.id}', '${echapperHTML(nomBoutique).replace(/'/g, "\\'")}', '${imageCouverture}')"
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

        // --- 2. LE LIEN MAGIQUE VIP ---
        const boutiqueRecherche = new URLSearchParams(window.location.search).get('boutique');
        if (boutiqueRecherche) {
            setTimeout(() => {
                const vendeurTrouve = vendeursVip ? vendeursVip.find(v => String(v.id) === String(boutiqueRecherche)) : null;
                const nomPourBanniere = vendeurTrouve ? vendeurTrouve.nom_boutique : "Boutique Officielle";
                const imagePourBanniere = vendeurTrouve ? (vendeurTrouve.image || vendeurTrouve.photo_couverture || vendeurTrouve.logo || '') : '';
                filtrerVIP(boutiqueRecherche, nomPourBanniere, imagePourBanniere);
            }, 800);
        }

        // --- NOUVEAU : SÉLECTION DU MOMENT (100% VIP) ---
        if (vendeursVip && vendeursVip.length > 0) {
            const numerosVIP = vendeursVip.map(v => String(v.id));
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
        if (ecranLoad) { ecranLoad.style.opacity = '0'; setTimeout(() => { ecranLoad.style.display = 'none'; }, 300); }
    }
               }
            function filtrerVIP(idVendeur, nomBoutique, imageCouverture = '') {
    const zoneBanniere = document.getElementById('banniere-vendeur');
    if(zoneBanniere) {
        const telVendeur = window.vendeursMap[idVendeur] || '';
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
                    <p class="text-yellow-400 text-[10px] font-black uppercase tracking-widest drop-shadow-md">Boutique Officielle VIP</p>
                </div>
                <h2 class="text-white text-2xl font-black uppercase leading-tight drop-shadow-lg">${echapperHTML(nomBoutique)}</h2>
            </div>
        </div>
        `;
    }

    document.getElementById('inputRecherche').value = nomBoutique;
    const resultats = articles.filter(a => String(a.vendeur) === String(idVendeur));

    document.getElementById('vue-accueil').classList.add('hidden');
    document.getElementById('vue-rayon').classList.add('hidden');
    document.getElementById('vue-boutique').classList.remove('hidden');

    document.getElementById('nav-accueil').classList.remove('active-nav');
    document.getElementById('nav-boutique').classList.add('active-nav');
    document.getElementById('menu-rayons').classList.add('hidden');
    
    afficherProduits(resultats, 'liste-boutique');

    setTimeout(() => {
        const listeElt = document.getElementById('liste-boutique');
        if(listeElt) listeElt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

function afficherNouveautes(liste, target) {
    const container = document.getElementById(target); if (!container) return;
    if (liste.length === 0) { container.innerHTML = '<p class="text-gray-400 text-[10px] italic">Aucune nouveauté</p>'; return; }
    container.innerHTML = liste.map(p => `<div class="scroll-item bg-white rounded-[15px] shadow-sm overflow-hidden flex flex-col relative border border-gray-50 active:scale-95 transition"><div class="price-badge" style="font-size:10px; padding:3px 8px; top:8px; right:8px;">${p.prix} F</div><img src="${p.image}" loading="lazy" onclick="ouvrirDetails('${p.nom.replace(/'/g, "\\'")}')" class="w-full h-24 object-cover"><div class="px-2 py-2 flex-1 flex flex-col text-center"><h3 class="font-black text-[#4c1d95] text-[9px] uppercase truncate mb-2">${p.nom}</h3><button onclick="ajouterAuPanier('${p.nom.replace(/'/g, "\\'")}', ${p.prix}, '${p.vendeur}')" class="w-full bg-[#f8f9fd] text-[#5b21b6] font-black py-2 rounded-xl text-[9px] uppercase border border-gray-100 active:bg-gray-100">Ajouter</button></div></div>`).join('');
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

    const totalPages = Math.ceil(listeTriee.length / elementsParPage);
    if (pageCourante > totalPages && totalPages > 0) pageCourante = totalPages;

    const debut = (pageCourante - 1) * elementsParPage;
    const fin = debut + elementsParPage;
    let listeFinale = listeTriee.slice(debut, fin);

    if (listeFinale.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1;" class="text-center py-8 text-gray-400">Aucun produit trouvé.</div>`;
        return;
    }

    listeTriee.sort((a, b) => {
        if (a.est_booste === true && b.est_booste !== true) return -1;
        if (b.est_booste === true && a.est_booste !== true) return 1;
        return 0;
    });

    container.innerHTML = listeFinale.map(p => {
        const designCarte = p.est_booste ? 'bg-orange-50 border-2 border-[#f97316]' : 'bg-white border-gray-100';
        const badgeSponsor = p.est_booste ? '<div class="absolute top-0 left-0 bg-[#f97316] text-white text-[9px] font-black px-2 py-1 rounded-br-lg z-20 shadow-md"><i class="fas fa-fire mr-1"></i>SPONSORISÉ</div>' : '';

        return `
        <div class="relative rounded-[20px] shadow-sm overflow-hidden flex flex-col ${designCarte}">
            <div class="relative w-full h-40 bg-gray-100">
                ${badgeSponsor}
                <img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="w-full h-full object-cover">
                <div class="price-badge"><small>FCFA</small></div>
            </div>
            <div class="p-3 flex flex-col flex-grow">
                <h1 class="font-black text-[12px] text-[#5b21b6] mb-1 uppercase leading-tight line-clamp-2">${echapperHTML(p.nom)}</h1>
                <div class="mt-auto flex gap-2">
                    <button onclick="ouvrirDetails('${p.nom.replace(/'/g, "\\'")}')" class="flex-1 bg-gray-100 text-[#5b21b6] py-2.5 rounded-xl text-[10px] font-black uppercase">
                        ${p.prix} F
                    </button>
                    <button onclick="ajouterAuPanier('${p.nom}', '${p.prix}', '${p.vendeur}')" class="w-10 h-10 bg-[#5b21b6] text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform">
                        <i class="fas fa-shopping-basket"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    if (listeTriee.length > elementsParPage) {
        const totalPages = Math.ceil(listeTriee.length / elementsParPage);
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

async function enregistrerInteraction(nomArticle, typeAction) {
    if (!monSupabase) return;
    try {
        await monSupabase.from('interactions_utilisateurs').insert([
            { device_id: deviceId, article_nom: nomArticle, action: typeAction }
        ]);
    } catch (error) {
        console.log("Erreur silencieuse", error);
    }
}

function ouvrirDetails(nom) {
    const p = articles.find(a => a.nom === nom); if (!p) return;
    enregistrerInteraction(nom, 'vue');
    const link = window.location.href.split('?')[0] + '?produit=' + encodeURIComponent(nom);

    window.messagePartage = `🌟 *${nom}* (${p.prix} F)\nVoir ici : ${link}`;

    document.getElementById('details-contenu').innerHTML = `
        <img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="w-full h-64 object-cover rounded-xl mb-4 shadow-sm active:scale-95 transition transform">
        <div class="flex justify-between items-center">
            <h3 class="font-black text-xl text-[#4c1d95]">${echapperHTML(nom)}</h3>
            <span class="text-orange-500 font-black text-lg">${p.prix} F</span>
        </div>
        <div class="text-gray-600 text-sm mt-2 mb-6 overflow-y-auto" style="max-height: 200px;">
            ${p.description ? echapperHTML(p.description) : 'Aucun détail supplémentaire.'}
        </div>
        <div class="flex gap-2">
            <button onclick="ajouterAuPanier('${nom.replace(/'/g, "\\'")}', '${p.prix}', '${p.vendeur}')" class="flex-1 bg-[#5b21b6] text-white font-black py-3 rounded-xl uppercase text-sm shadow-md transition transform active:scale-95">Ajouter au panier</button>
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

function ajouterAuPanier(nom, prix, tel) {
    panier.push({ nom, prix, tel });
    const badgeNav = document.getElementById('panier-count-nav');
    if (badgeNav) badgeNav.innerText = panier.length;
}

function ouvrirPanier() {
    const container = document.getElementById('panier-liste');
    const totalElt = document.getElementById('panier-total');

    if (panier.length === 0) {
        container.innerHTML = '<p class="text-center py-6 font-bold text-gray-400">Panier vide</p>';
        if(totalElt) totalElt.innerText = "0 FCFA";
        const modal = document.getElementById('modal-panier');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        return;
    }

    let totalGlobal = 0;
    const vendeurs = {};

    panier.forEach((p, index) => {
        totalGlobal += parseInt(p.prix);
        const tel = p.tel || '2250576326645';
        if (!vendeurs[tel]) vendeurs[tel] = [];
        vendeurs[tel].push({ ...p, index });
    });

    if(totalElt) totalElt.innerText = totalGlobal + " FCFA";

    container.innerHTML = Object.keys(vendeurs).map(tel => {
        const items = vendeurs[tel];
        let sousTotal = 0;

        const htmlItems = items.map(i => {
            sousTotal += parseInt(i.prix);
            return `<div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl"><div class="flex-1 pr-4"><p class="font-black text-[10px] text-gray-800 uppercase truncate">${echapperHTML(i.nom)}</p><p class="text-orange-500 font-bold text-xs">${i.prix} F</p></div><button onclick="retirerDuPanier(${i.index})" class="w-8 h-8 bg-red-100 text-red-500 rounded-lg flex items-center justify-center active:scale-90"><i class="fas fa-trash-alt"></i></button></div>`;
        }).join('');

        return '<div class="bg-white rounded-2xl p-4 border border-gray-100 mb-4 shadow-sm"><p class=\"font-black text-[#5b21b6] text-[10px] uppercase mb-3 border-b border-gray-100 pb-2\">Boutique : ' + (window.vendeursMap[tel] || tel) + '</p><div class="space-y-2 mb-4">' + htmlItems + '</div><button onclick="validerCommande(\'' + tel + '\', \'' + tel + '\')" class="w-full bg-[#25D366] text-white font-black py-3 rounded-xl uppercase text-[10px] flex items-center justify-center gap-2 active:scale-95 transition"><i class="fab fa-whatsapp text-lg"></i> Commander ces articles</button></div>';
    }).join('');

    const modal = document.getElementById('modal-panier');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function retirerDuPanier(index) {
    panier.splice(index, 1);
    const badgeNav = document.getElementById('panier-count-nav');
    if (badgeNav) badgeNav.innerText = panier.length;
    localStorage.setItem('coeur_panier', JSON.stringify(panier));
    ouvrirPanier();
}

async function validerCommande(telWhatsApp, telVendeur) {
    const ecranLoad = document.getElementById('ecran-chargement');
    if (ecranLoad) { ecranLoad.style.display = 'flex'; ecranLoad.style.opacity = '1'; }

    try {
        const articlesVendeur = panier.filter(p => String(p.tel) === String(telVendeur));
        if (articlesVendeur.length === 0) return;

        let vraiTotal = 0;
        const itemsPourBase = [];
        let detailTexte = "";

        articlesVendeur.forEach(p => {
            const articleReel = articles.find(a => a.nom === p.nom && String(a.vendeur) === String(p.tel))
            if (articleReel) {
                vraiTotal += parseInt(articleReel.prix);
                itemsPourBase.push({ id_produit: articleReel.id, prix: articleReel.prix, nom: articleReel.nom });
                detailTexte += `- ${articleReel.nom} (${articleReel.prix} F)\n`;
            }
        });

        const { data, error } = await monSupabase
            .from('commandes')
            .insert([{
                device_id: deviceId,
                vendeur_tel: String(telVendeur),
                total_fcfa: vraiTotal,
                items: itemsPourBase
            }])
            .select();

        if (error) throw error;

        const numeroCmd = data[0].numero_commande;
        const codeAffiche = "CMD-" + numeroCmd;

        const messageFinal = `🛒 *NOUVELLE COMMANDE #${codeAffiche}*\n\nDétails :\n${detailTexte}\n*TOTAL : ${vraiTotal} FCFA*\n\n_Cette commande est sécurisée dans le système._`;
        const msgEncoded = encodeURIComponent(messageFinal);

        panier = panier.filter(p => String(p.tel) !== String(telVendeur));
        localStorage.setItem('coeur_panier', JSON.stringify(panier));

        const badgeNav = document.getElementById('panier-count-nav');
        if (badgeNav) badgeNav.innerText = panier.length;
        if (panier.length === 0) fermerPanier(); else ouvrirPanier();

        let numeroWa = String(window.vendeursMap[telVendeur] || telWhatsApp).replace(/\s+/g, '').replace('+', '');
        if (numeroWa.length === 10) {
            numeroWa = '225' + numeroWa;
        }
        window.open('https://wa.me/' + numeroWa + '?text=' + msgEncoded);

    } catch (err) {
        console.error("Erreur lors de la commande :", err);
        alert("Une erreur est survenue lors de la création de la commande. Veuillez vérifier votre connexion internet.");
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

    if (v === 'boutique') {
        const menu = document.getElementById('menu-rayons');
        if(menu) menu.classList.remove('hidden');

        const banniere = document.getElementById('banniere-vendeur');
        if(banniere) banniere.innerHTML = '';

        afficherProduits(articles, 'liste-boutique');
    }
    window.scrollTo(0,0);
}

function filtrerAccueil(c) { document.getElementById('titre-rayon').innerText = c; const f = articles.filter(a => a.categorie && a.categorie.includes(c)); afficherProduits(f, 'liste-rayon'); changerVue('rayon'); }
function filtrerBoutique(cat) { document.getElementById('titre-rayon').innerText = cat; const filtered = articles.filter(a => a.categorie === cat); afficherProduits(filtered, 'liste-rayon'); changerVue('rayon'); }

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

    recognition.onerror = function(event) {
        afficherAlerteCustom('Erreur', 'Je n\'ai pas bien entendu. Réessayez.');
    };

    recognition.onend = function() {
        iconMicro.classList.add('fa-microphone');
        iconMicro.classList.remove('fa-microphone-slash', 'text-red-500');
    };

    recognition.start();
}

function rechercherProduit(event) {
    const s = document.getElementById('inputRecherche').value.toLowerCase();
    const filtered = articles.filter(a => a.nom && a.nom.toLowerCase().includes(s));

    let target = 'liste-boutique';
    if (!document.getElementById('vue-rayon').classList.contains('hidden')) {
        target = 'liste-rayon';
    } else {
        if (!document.getElementById('vue-accueil').classList.contains('hidden') && s.length > 0) {
            changerVue('boutique');
        }
    }

    afficherProduits(filtered, target);
    
    const menuRayons = document.getElementById('menu-rayons');
    if (menuRayons) menuRayons.classList.add('hidden');
    const avenueBoutiques = document.getElementById('avenue-boutiques-vip');
    if (avenueBoutiques) avenueBoutiques.parentElement.classList.add('hidden');

    if (event && event.key === 'Enter') {
        document.getElementById('inputRecherche').blur();
    }
}

function partagerBoutique(tel, nom) {
    const baseUrl = window.location.href.split('?')[0];
    const lienMagique = baseUrl + '?boutique=' + tel;
    const message = "👋 Visitez ma boutique officielle *" + nom + "* sur Cœur de Marché Bouaflé !\n\n🛒 Cliquez sur ce lien pour voir tous mes articles : \n" + lienMagique;

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
window.addEventListener('scroll', () => { const btn = document.getElementById('btn-remonter'); if (window.scrollY > 300) btn.classList.add('show'); else btn.classList.remove('show'); });

init();
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); }); }
            
