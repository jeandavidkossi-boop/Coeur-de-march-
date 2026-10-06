let articles = [];
let panier = JSON.parse(localStorage.getItem('coeur_panier')) || [];
let favoris = (() => { try { const v = JSON.parse(localStorage.getItem('coeur_favoris')); return Array.isArray(v) ? v.map(String) : []; } catch (e) { return []; } })();
const filtreFavoris = { boutique: false, rayon: false };
let minuteurFiltres = null;

function estFavori(id) { return favoris.includes(String(id)); }
function iconeCoeur(id) { return estFavori(id) ? 'fas fa-heart text-red-500' : 'far fa-heart text-gray-300'; }

function basculerFavori(id, event) {
    if (event) event.stopPropagation();
    id = String(id);
    if (estFavori(id)) { favoris = favoris.filter(f => f !== id); afficherToastPanier("Retiré des favoris"); } 
    else { favoris.push(id); afficherToastPanier("Ajouté aux favoris ❤️"); }
    try { localStorage.setItem('coeur_favoris', JSON.stringify(favoris)); } catch (e) {}
    document.querySelectorAll(`[data-fav-id="${id}"] i`).forEach(ic => ic.className = iconeCoeur(id));
    if ((cibleCourante === 'liste-boutique' && filtreFavoris.boutique) || (cibleCourante === 'liste-rayon' && filtreFavoris.rayon)) { afficherProduits(articlesCourants, cibleCourante, false); }
}

function appliquerFiltres(suffixe) {
    clearTimeout(minuteurFiltres);
    minuteurFiltres = setTimeout(() => { afficherProduits(articlesCourants, 'liste-' + suffixe); }, 250);
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

let articlesCourants = [], cibleCourante = '', pageCourante = 1;
const elementsParPage = 12, NUMERO_LIVRAISON = '2250143812759';
let modeReceptionChoisi = 'retrait', monSupabase, deviceId = localStorage.getItem('coeur_device_id') || ('tel_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now());
localStorage.setItem('coeur_device_id', deviceId);

window.articlesParId = new Map(); window.vendeursMap = {}; window.nomsBoutiquesParTel = {}; window.tousVendeursListe = [];
let intervalCarrousel, timerToastPanier;

function formaterPrix(montant) { const n = parseInt(String(montant ?? '0').replace(/\s+/g, ''), 10); return isNaN(n) ? montant : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function pousserHistorique() { if (window.history && window.history.pushState) window.history.pushState({ cdmNav: true }, ''); }

window.addEventListener('popstate', () => {
    const d = document.getElementById('modal-details');
    if (d && d.style.display === 'block') { fermerModalDetails(true); return; }
    ['modal-alerte', 'modal-panier'].forEach(id => { const m = document.getElementById(id); if (m && m.style.display === 'flex') m.click(); });
    const vueRayon = document.getElementById('vue-rayon');
    if (vueRayon && !vueRayon.classList.contains('hidden')) { changerVue('boutique', true); return; }
    const vueBoutique = document.getElementById('vue-boutique');
    if (vueBoutique && !vueBoutique.classList.contains('hidden')) { changerVue('accueil', true); return; }
});

function mettreAJourBadgePanier() {
    const b = document.getElementById('panier-count-nav');
    if (b) b.innerText = panier.reduce((acc, item) => acc + (parseInt(item.quantite) || 1), 0);
}
mettreAJourBadgePanier();

function afficherToastPanier(texte = "Ajouté au panier") {
    const t = document.getElementById('toast-panier'); if (!t) return;
    t.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${texte}`;
    t.classList.add('show'); clearTimeout(timerToastPanier); timerToastPanier = setTimeout(() => t.classList.remove('show'), 2500);
}

function afficherAlerteCustom(titre, message) {
    document.getElementById('alerte-titre').innerText = titre; document.getElementById('alerte-message').innerText = message;
    const m = document.getElementById('modal-alerte'); m.style.display = 'flex'; pousserHistorique(); setTimeout(() => m.classList.add('active'), 10);
}
function fermerAlerte() { const m = document.getElementById('modal-alerte'); if (!m) return; m.classList.remove('active'); setTimeout(() => m.style.display = 'none', 300); }

function echapperHTML(texte) { const div = document.createElement('div'); div.textContent = String(texte ?? ''); return div.innerHTML; }
function normaliserTexte(texte) { return String(texte || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function boostEstActif(produit) { return produit && produit.est_booste === true && (!produit.fin_boost || new Date(produit.fin_boost) >= new Date()); }
function trouverArticle(idOuNom) { const cle = String(idOuNom); return window.articlesParId.get(cle) || articles.find(a => String(a.id) === cle || a.nom === cle) || null; }

function extraireYoutubeId(url) {
    let id = String(url || '');
    const match = id.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (match && match[1]) id = match[1];
    return id;
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

async function init() {
    const elLoad = document.getElementById('ecran-chargement');
    try {
        monSupabase = window.supabase.createClient("https://szhxxohizqnwcmsltjtq.supabase.co", "sb_publishable_hfQrBZ4OYrkHjUxvtzCL_g_mi05THSO");
        monSupabase.rpc('verifier_expirations').catch(()=>{});
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

        if (produitsData) { articles = produitsData; window.articlesParId = new Map(articles.map(a => [String(a.id), a])); }
        if (annonceData) document.getElementById('texte-annonce').innerText = annonceData.message;
        
        window.tousVendeursListe = tousVendeurs || [];
        window.tousVendeursListe.forEach(v => { const t = String(v.whatsapp || '').trim(); window.vendeursMap[v.id] = t; if (t) window.nomsBoutiquesParTel[t] = v.nom_boutique || 'Boutique'; });
        
        if(pubData && pubData.length > 0) {
            const cv = document.getElementById('carrousel-vip');
            if(cv) {
                cv.innerHTML = pubData.map(p => `<img src="${p.image}" class="min-w-[85vw] h-32 rounded-lg object-cover border border-gray-200 shrink-0" onclick="${p.id_produit ? `ouvrirDetails('${p.id_produit}')` : ''}">`).join('');
                setTimeout(demarrerCarrouselAuto, 1000);
            }
        }

        const conteneurTV = document.getElementById('conteneur-tv');
        if (tvData && tvData.lien_youtube && conteneurTV) {
            const articleTV = tvData.id_produit ? trouverArticle(tvData.id_produit) : null;
            let boutonAction = "";
            if (articleTV) {
                boutonAction = `<button onclick="ouvrirDetails('${articleTV.id}')" class="mt-3 w-full bg-[#f97316] text-white font-bold py-2 rounded-md text-sm shadow-sm active:bg-orange-600 transition">Acheter ce produit</button>`;
            }
            const youtubeIdNettoye = extraireYoutubeId(tvData.lien_youtube);
            conteneurTV.innerHTML = `<div class="bg-white p-2 rounded-lg border border-gray-200 shadow-sm"><div class="video-container rounded-md overflow-hidden"><iframe src="https://www.youtube.com/embed/${youtubeIdNettoye}" frameborder="0" allowfullscreen></iframe></div>${boutonAction}</div>`;
        }
        
        const maintenant = new Date();
        const bVip = window.tousVendeursListe.filter(v => v.abonnement === 'vip' && (!v.fin_abonnement || new Date(v.fin_abonnement) >= maintenant));
        const av = document.getElementById('avenue-boutiques-vip');
        if(av && bVip.length > 0) {
            av.innerHTML = bVip.map(v => `<div onclick="filtrerVIP('${v.id}')" class="min-w-[120px] bg-white border border-gray-200 rounded-lg p-3 flex flex-col items-center shadow-sm"><div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 font-bold mb-2">${(v.nom_boutique||'B')[0].toUpperCase()}</div><span class="text-[10px] font-bold text-gray-800 text-center line-clamp-1 w-full">${echapperHTML(v.nom_boutique)}</span></div>`).join('');
        }

        const selVip = articles.filter(a => bVip.map(v=>String(v.whatsapp)).includes(String(a.vendeur))).sort(() => 0.5 - Math.random()).slice(0, 6);
        afficherNouveautes(selVip.length > 0 ? selVip : [...articles].reverse().slice(0, 6), 'liste-nouveautes');

        const produitRecherche = new URLSearchParams(window.location.search).get('produit');
        if (produitRecherche) setTimeout(() => { ouvrirDetails(produitRecherche); }, 500);
        
        const boutiqueRecherche = new URLSearchParams(window.location.search).get('boutique');
        if (boutiqueRecherche) setTimeout(() => { filtrerVIP(boutiqueRecherche); }, 800);

    } catch (e) { console.log(e); document.getElementById('texte-annonce').innerText = "Erreur de connexion."; } 
    finally { if (elLoad) { elLoad.style.opacity = '0'; setTimeout(() => elLoad.style.display = 'none', 300); } }
}

function filtrerVIP(idVendeur) {
    pousserHistorique(); const telVendeur = window.vendeursMap[idVendeur] || idVendeur || '';
    const v = window.tousVendeursListe.find(x => String(x.id) === String(idVendeur) || String(x.whatsapp) === String(telVendeur));
    document.getElementById('banniere-vendeur').innerHTML = v ? `<div class="bg-white p-4 border border-gray-200 rounded-lg flex items-center justify-between mb-4 shadow-sm"><div class="flex items-center gap-4"><div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-xl">${(v.nom_boutique||'B')[0].toUpperCase()}</div><div><h2 class="font-bold text-gray-900">${echapperHTML(v.nom_boutique)}</h2><span class="text-[10px] text-gray-500">Boutique Partenaire</span></div></div><button onclick="partagerBoutique('${telVendeur}', '${echapperHTML(v.nom_boutique).replace(/'/g, "\\'")}')" class="w-8 h-8 flex items-center justify-center text-gray-500 bg-gray-50 border border-gray-200 rounded-full"><i class="fas fa-share-alt"></i></button></div>` : '';
    document.getElementById('inputRecherche').value = v ? v.nom_boutique : '';
    changerVue('boutique', true); afficherProduits(articles.filter(a => String(a.vendeur) === String(telVendeur)), 'liste-boutique');
}

// -------------------------------------------------------------
// DESIGN CARTES (STYLE JUMIA) ET CORRECTION NOMS
// -------------------------------------------------------------
function afficherNouveautes(liste, target) {
    const container = document.getElementById(target); if (!container) return;
    if (liste.length === 0) { container.innerHTML = '<p class="text-gray-400 text-[10px] italic">Aucune nouveauté</p>'; return; }
    container.innerHTML = liste.map(p => {
        const nomBoutique = window.nomsBoutiquesParTel[String(p.vendeur || '').trim()] || 'Boutique';
        return `
        <div class="scroll-item bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col active:bg-gray-50 transition" onclick="ouvrirDetails('${p.id}')">
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
    articlesCourants = liste; cibleCourante = target; const c = document.getElementById(target); if (!c) return;
    if (resetPage) pageCourante = 1; let l = [...liste];
    const s = target === 'liste-boutique' ? 'boutique' : (target === 'liste-rayon' ? 'rayon' : null);
    if (s) {
        const min = parseInt(document.getElementById('prix-min-'+s)?.value, 10), max = parseInt(document.getElementById('prix-max-'+s)?.value, 10);
        l = l.filter(p => { const px = parseInt(p.prix)||0; return (!(px < min) && !(px > max) && (!filtreFavoris[s] || estFavori(p.id))); });
    }
    const tri = document.getElementById('tri-prix-'+(s||'boutique'))?.value || 'recent';
    if (tri === 'croissant') l.sort((a, b) => parseInt(a.prix) - parseInt(b.prix)); else if (tri === 'decroissant') l.sort((a, b) => parseInt(b.prix) - parseInt(a.prix)); else l.reverse();
    l.sort((a, b) => (boostEstActif(b)?1:0) - (boostEstActif(a)?1:0));

    const tp = Math.ceil(l.length / elementsParPage); if (pageCourante > tp && tp > 0) pageCourante = tp;
    const f = l.slice((pageCourante - 1) * elementsParPage, pageCourante * elementsParPage);
    if (f.length === 0) { c.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-sm">Aucun produit trouvé.</div>`; return; }

    c.innerHTML = f.map(p => {
        const nomBoutique = window.nomsBoutiquesParTel[String(p.vendeur || '').trim()] || 'Boutique';
        return `
        <div class="bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col relative active:border-purple-300 transition" onclick="ouvrirDetails('${p.id}')">
            ${boostEstActif(p) ? '<span class="absolute top-0 left-0 bg-[#f97316] text-white text-[9px] font-bold px-1.5 py-0.5 z-10 rounded-br">Sponsorisé</span>' : ''}
            <div class="relative w-full h-40 bg-gray-50">
                <img src="${p.image}" loading="lazy" class="w-full h-full object-cover">
                <button data-fav-id="${p.id}" onclick="basculerFavori('${p.id}', event)" class="absolute top-2 right-2 z-20 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center"><i class="${iconeCoeur(p.id)} text-sm"></i></button>
            </div>
            <div class="p-2.5 flex flex-col flex-grow">
                <h3 class="text-xs text-gray-700 font-medium line-clamp-2 leading-snug mb-1">${echapperHTML(p.nom)}</h3>
                <p class="text-base font-black text-gray-900 mt-auto">${formaterPrix(p.prix)} F</p>
                <p class="text-[10px] text-gray-400 mt-0.5 truncate">${echapperHTML(nomBoutique)}</p>
            </div>
        </div>`;
    }).join('');
    
    if (l.length > elementsParPage) {
        let paginationHtml = `<div style="grid-column: 1 / -1;" class="flex justify-center items-center gap-2 mt-6 mb-8 flex-wrap">`;
        if (pageCourante > 1) paginationHtml += `<button onclick="allerPage(${pageCourante - 1})" class="bg-white border border-gray-300 text-gray-700 font-bold text-xs px-3.5 py-2 rounded-md shadow-sm">Précédent</button>`;
        for (let i = 1; i <= tp; i++) {
            if (i === pageCourante) paginationHtml += `<span class="bg-[#5b21b6] text-white font-bold text-xs px-3.5 py-2 rounded-md">${i}</span>`;
            else paginationHtml += `<button onclick="allerPage(${i})" class="bg-white border border-gray-300 text-gray-700 font-bold text-xs px-3.5 py-2 rounded-md">${i}</button>`;
        }
        if (pageCourante < tp) paginationHtml += `<button onclick="allerPage(${pageCourante + 1})" class="bg-white border border-gray-300 text-gray-700 font-bold text-xs px-3.5 py-2 rounded-md shadow-sm">Suivant</button>`;
        c.innerHTML += paginationHtml + `</div>`;
    }
}
function allerPage(numPage) { pageCourante = numPage; afficherProduits(articlesCourants, cibleCourante, false); const c = document.getElementById(cibleCourante); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function changerTriBoutique() { afficherProduits(articlesCourants, 'liste-boutique'); }
function changerTriRayon() { afficherProduits(articlesCourants, 'liste-rayon'); }

async function enregistrerInteraction(article, typeAction) {
    if (!monSupabase || !article) return;
    if (typeAction === 'vue') { const cleVue = 'cdm_vue_' + String(article.id); if (sessionStorage.getItem(cleVue)) return; sessionStorage.setItem(cleVue, '1'); }
    try { await monSupabase.from('interactions_utilisateurs').insert([{ device_id: deviceId, article_nom: article.nom, id_produit: String(article.id), vendeur_tel: String(article.vendeur || ''), action: typeAction }]); } catch (e) {}
}

// -------------------------------------------------------------
// NOUVELLE FICHE PRODUIT PLEIN ÉCRAN (AVEC CORRECTION CLIC VENDEUR)
// -------------------------------------------------------------
function ouvrirDetails(idOuNom) {
    const p = trouverArticle(idOuNom); if (!p) return;
    enregistrerInteraction(p, 'vue');
    const nomBoutique = window.nomsBoutiquesParTel[String(p.vendeur || '').trim()] || 'Boutique';
    window.messagePartage = `${p.nom} - ${formaterPrix(p.prix)} FCFA sur Cœur de Marché Bouaflé.\nVoir ici : ${window.location.href.split('?')[0]}?produit=${encodeURIComponent(p.id)}`;

    const similaires = articles.filter(a => a.categorie === p.categorie && String(a.id) !== String(p.id)).sort(()=>0.5-Math.random()).slice(0, 4);
    let htmlSim = '';
    if(similaires.length > 0) {
        htmlSim = `<div class="mt-8 pt-6 border-t border-gray-100">
            <h3 class="font-bold text-gray-800 text-sm mb-4">Vous aimerez aussi</h3>
            <div class="grid grid-cols-2 gap-3">
                ${similaires.map(sim => `
                <div class="bg-white border border-gray-200 rounded-md overflow-hidden active:bg-gray-50" onclick="ouvrirDetails('${sim.id}')">
                    <img src="${p.image}" onclick="ouvrirImage('${p.image}')" class="w-full h-full object-contain active:scale-95 transition-transform">
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
            <img src="${p.image}" class="w-full h-full object-contain">
        </div>
        <div class="p-4">
            <h1 class="text-lg text-gray-800 font-medium leading-snug mb-2">${echapperHTML(p.nom)}</h1>
            <p class="text-2xl font-black text-gray-900 mb-6">${formaterPrix(p.prix)} FCFA</p>
            
            <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 p-3 rounded-lg mb-6" onclick="fermerModalDetails(); setTimeout(() => filtrerVIP('${p.vendeur}'), 300);">
                <div class="w-10 h-10 bg-white rounded-full border border-gray-200 flex items-center justify-center text-gray-400"><i class="fas fa-store"></i></div>
                <div>
                    <p class="text-[10px] text-gray-500 font-medium uppercase">Vendu par</p>
                    <p class="text-sm font-bold text-[#f97316]">${echapperHTML(nomBoutique)}</p>
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
            <button data-fav-id="${p.id}" onclick="basculerFavori('${p.id}', event)" class="w-12 flex items-center justify-center border border-gray-300 rounded text-xl active:bg-gray-50"><i class="${iconeCoeur(p.id)}"></i></button>
            <button onclick="ajouterAuPanier('${p.id}')" class="flex-1 bg-[#f97316] text-white font-bold text-sm rounded shadow-sm active:bg-orange-600 transition-colors">Ajouter au panier</button>
        </div>
    `;

    const m = document.getElementById('modal-details'); m.style.display = 'block'; pousserHistorique();
    setTimeout(() => m.classList.add('active'), 10); m.scrollTop = 0;
}

function fermerModalDetails(depuisRetour = false) {
    const m = document.getElementById('modal-details'); if (!m || m.style.display === 'none') return;
    m.classList.remove('active'); setTimeout(() => m.style.display = 'none', 300);
                                                                   }

// -------------------------------------------------------------
// GESTION DU PANIER & COMMANDE
// -------------------------------------------------------------
function choisirModeReception(mode) {
    modeReceptionChoisi = mode;
    const br = document.getElementById('btn-mode-retrait'), bl = document.getElementById('btn-mode-livraison'), z = document.getElementById('zone-quartier-livraison');
    if (!br || !bl || !z) return;
    if (mode === 'livraison') {
        bl.className = "py-2 px-2 rounded border border-[#f97316] bg-[#f97316] text-white text-xs font-bold transition";
        br.className = "py-2 px-2 rounded border border-gray-300 bg-white text-gray-600 text-xs font-medium transition";
        z.classList.remove('hidden');
    } else {
        br.className = "py-2 px-2 rounded border border-[#f97316] bg-[#f97316] text-white text-xs font-bold transition";
        bl.className = "py-2 px-2 rounded border border-gray-300 bg-white text-gray-600 text-xs font-medium transition";
        z.classList.add('hidden');
    }
}

function ajouterAuPanier(idOuNom, prixFallback, telFallback) {
    const p = trouverArticle(idOuNom); const idProd = p ? String(p.id) : String(idOuNom), nom = p ? p.nom : String(idOuNom), prix = p ? parseInt(p.prix) : parseInt(prixFallback||0), tel = String((p ? p.vendeur : telFallback)||'').trim();
    if (!tel) { afficherAlerteCustom("Indisponible", "Vendeur introuvable."); return; }
    const ex = panier.find(i => (i.id && String(i.id) === idProd) || (!i.id && i.nom === nom && String(i.tel) === tel));
    if (ex) { ex.quantite = (parseInt(ex.quantite)||1)+1; ex.id = idProd; } else { panier.push({ id: idProd, nom: nom, prix: prix, tel: tel, quantite: 1 }); }
    localStorage.setItem('coeur_panier', JSON.stringify(panier)); mettreAJourBadgePanier(); afficherToastPanier();
    if (p) enregistrerInteraction(p, 'panier');
}

function modifierQuantitePanier(index, delta) {
    if (!panier[index]) return; const nQ = (parseInt(panier[index].quantite)||1) + delta;
    if (nQ <= 0) panier.splice(index, 1); else panier[index].quantite = nQ;
    localStorage.setItem('coeur_panier', JSON.stringify(panier)); mettreAJourBadgePanier(); ouvrirPanier(true);
}

function ouvrirPanier(estRaf = false) {
    const c = document.getElementById('panier-liste'), t = document.getElementById('panier-total'), m = document.getElementById('modal-panier');
    if (!estRaf && m.style.display !== 'flex') pousserHistorique();
    if (panier.length === 0) { c.innerHTML = '<p class="text-center py-10 text-gray-400 text-sm">Votre panier est vide</p>'; if(t) t.innerText = "0 F"; m.style.display = 'flex'; setTimeout(() => m.classList.add('active'), 10); return; }
    
    let tG = 0; const vends = {};
    panier.forEach((p, i) => { const q = parseInt(p.quantite)||1; tG += (parseInt(p.prix)||0)*q; const tl = String(p.tel||'').trim(); if(!tl) return; if(!vends[tl]) vends[tl]=[]; vends[tl].push({...p, quantite:q, index:i}); });
    if(t) t.innerText = formaterPrix(tG) + " FCFA";

    c.innerHTML = Object.keys(vends).map(tel => {
        const items = vends[tel]; let sT = 0; const nB = window.nomsBoutiquesParTel[tel] || tel;
        const html = items.map(i => {
            const tl = (parseInt(i.prix)||0)*i.quantite; sT += tl;
            return `<div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                <div class="flex-1 pr-2"><p class="text-xs text-gray-800 font-medium truncate">${echapperHTML(i.nom)}</p><p class="text-sm font-bold text-gray-900">${formaterPrix(i.prix)} F <span class="text-xs text-gray-400 font-normal">x${i.quantite}</span></p></div>
                <div class="flex items-center gap-2"><div class="flex items-center bg-gray-50 border border-gray-200 rounded"><button onclick="modifierQuantitePanier(${i.index},-1)" class="w-8 h-8 flex items-center justify-center text-gray-600">-</button><span class="w-6 text-center text-xs font-bold">${i.quantite}</span><button onclick="modifierQuantitePanier(${i.index},1)" class="w-8 h-8 flex items-center justify-center text-gray-600">+</button></div><button onclick="retirerDuPanier(${i.index})" class="w-8 h-8 text-red-400"><i class="fas fa-trash-alt"></i></button></div>
            </div>`;
        }).join('');
        return `<div class="bg-white rounded-lg border border-gray-200 mb-4 p-3"><div class="flex justify-between items-center pb-2 border-b border-gray-100 mb-2"><p class="text-xs font-bold text-gray-800"><i class="fas fa-store text-gray-400 mr-1"></i> ${echapperHTML(nB)}</p><span class="text-xs font-bold text-[#f97316]">${formaterPrix(sT)} F</span></div>${html}<button onclick="validerCommande('${tel}','${tel}')" class="w-full mt-3 bg-[#25D366] text-white font-bold text-sm py-3 rounded flex items-center justify-center gap-2"><i class="fab fa-whatsapp text-lg"></i> Commander</button></div>`;
    }).join('');
    m.style.display = 'flex'; setTimeout(() => m.classList.add('active'), 10);
}
function fermerPanier() { const m = document.getElementById('modal-panier'); if (!m) return; m.classList.remove('active'); setTimeout(() => m.style.display = 'none', 300); }

async function validerCommande(telWA, telVendeur) {
    const q = document.getElementById('quartier-livraison')?.value.trim();
    if (modeReceptionChoisi === 'livraison' && !q) { afficherAlerteCustom("Attention", "Veuillez indiquer votre quartier."); return; }
    const el = document.getElementById('ecran-chargement'); if(el) { el.style.display='flex'; el.style.opacity='1'; }
    try {
        const aV = panier.filter(p => String(p.tel).trim() === String(telVendeur).trim()); if (aV.length === 0) return;
        let vT = 0; const items = []; let dTxt = "";
        aV.forEach(p => {
            const qte = parseInt(p.quantite)||1; const aR = trouverArticle(p.id) || articles.find(a=>a.nom===p.nom&&String(a.vendeur)===String(p.tel));
            const pU = aR ? parseInt(aR.prix) : parseInt(p.prix); const sT = pU * qte; vT += sT;
            items.push({ id_produit: aR ? aR.id : (p.id||null), prix: pU, nom: aR ? aR.nom : p.nom, quantite: qte });
            dTxt += `- ${qte}x ${aR ? aR.nom : p.nom} (${formaterPrix(sT)} F)\n`;
        });
        const { data, error } = await monSupabase.from('commandes').insert([{ device_id: deviceId, vendeur_tel: String(telVendeur), total_fcfa: vT, items: items, mode_reception: modeReceptionChoisi, quartier_livraison: modeReceptionChoisi==='livraison'?q:null }]).select();
        if (error) throw error;
        const msg = encodeURIComponent(`🛒 *NOUVELLE COMMANDE #CMD-${data[0].numero_commande}*\n\nDétails :\n${dTxt}\n*TOTAL : ${formaterPrix(vT)} FCFA*\n\n${modeReceptionChoisi==='livraison'?`🛵 LIVRAISON : ${q}`:`🏪 RETRAIT BOUTIQUE`}`);
        panier = panier.filter(p => String(p.tel).trim() !== String(telVendeur).trim()); localStorage.setItem('coeur_panier', JSON.stringify(panier)); mettreAJourBadgePanier();
        if (panier.length === 0) fermerPanier(); else ouvrirPanier(true);
        let num = String(window.vendeursMap[telVendeur]||telWA).replace(/\s+/g,'').replace('+',''); if(num.length===10) num='225'+num;
        window.open('https://wa.me/'+num+'?text='+msg);
    } catch (e) { afficherAlerteCustom("Erreur", "Vérifiez votre connexion."); } finally { if(el) { el.style.opacity='0'; setTimeout(()=>el.style.display='none',300); } }
}

function changerVue(v, depuisRetour = false) {
    if (!depuisRetour && v !== 'accueil') pousserHistorique();
    document.getElementById('inputRecherche').value = '';
    ['accueil', 'boutique', 'rayon'].forEach(id => document.getElementById('vue-'+id).classList.add('hidden'));
    document.getElementById('vue-'+v).classList.remove('hidden');
    ['accueil', 'boutique'].forEach(id => { const el=document.getElementById('nav-'+id); if(el) el.classList.remove('active-nav'); });
    const n = document.getElementById('nav-'+v); if(n) n.classList.add('active-nav');
    if (v === 'boutique') { document.getElementById('banniere-vendeur').innerHTML = ''; afficherProduits(articles, 'liste-boutique'); }
    window.scrollTo(0, 0);
}

function filtrerAccueil(c) { document.getElementById('titre-rayon').innerText = c; const n = normaliserTexte(c); afficherProduits(articles.filter(a => normaliserTexte(a.categorie).includes(n)), 'liste-rayon'); changerVue('rayon'); }
function filtrerBoutique(cat) { document.getElementById('titre-rayon').innerText = cat; afficherProduits(articles.filter(a => normaliserTexte(a.categorie) === normaliserTexte(cat)), 'liste-rayon'); changerVue('rayon'); }

function lancerMicro() {
    const iconMicro = document.getElementById('iconMicro');
    const inputRecherche = document.getElementById('inputRecherche');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { afficherAlerteCustom('Désolé', 'Votre navigateur ne supporte pas la recherche vocale.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR'; recognition.interimResults = false;
    recognition.onstart = function() { iconMicro.classList.replace('fa-microphone', 'fa-microphone-slash'); iconMicro.classList.add('text-red-500'); };
    recognition.onresult = function(event) { inputRecherche.value = event.results[0][0].transcript; rechercherProduit({ key: 'Enter' }); };
    recognition.onerror = function() { afficherAlerteCustom('Erreur', 'Je n\'ai pas bien entendu. Réessayez.'); };
    recognition.onend = function() { iconMicro.classList.replace('fa-microphone-slash', 'fa-microphone'); iconMicro.classList.remove('text-red-500'); };
    recognition.start();
}

function rechercherProduit(event) {
    const s = normaliserTexte(document.getElementById('inputRecherche').value);
    if (!s) { changerVue('boutique', true); return; }
    const f = articles.filter(a => normaliserTexte(a.nom).includes(s) || normaliserTexte(a.description).includes(s) || normaliserTexte(a.categorie).includes(s));
    let tgt = 'liste-boutique';
    if (!document.getElementById('vue-rayon').classList.contains('hidden')) tgt = 'liste-rayon';
    else if (!document.getElementById('vue-accueil').classList.contains('hidden')) { changerVue('boutique', true); }
    afficherProduits(f, tgt);
}

function partagerBoutique(tel, nom) {
    const baseUrl = window.location.href.split('?')[0]; const lienMagique = baseUrl + '?boutique=' + tel;
    const message = `👋 Visitez la boutique *${nom}* sur Cœur de Marché Bouaflé !\n\n🛒 Voir les articles : \n${lienMagique}`;
    if (navigator.share) navigator.share({ title: nom, text: message }).catch(()=>{});
    else window.open('https://wa.me/?text=' + encodeURIComponent(message));
}

function partager() { if (navigator.share) navigator.share({ text: window.messagePartage }); else window.open('https://wa.me/?text=' + encodeURIComponent(window.messagePartage)); }
function remonterHaut() { window.scrollTo({ top: 0, behavior: "smooth" }); }
window.addEventListener('scroll', () => { const b = document.getElementById('btn-remonter'); if (window.scrollY > 300) b.classList.add('show'); else b.classList.remove('show'); });

init();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
                   
