const dbUrl = "https://szhxxohizqnwcmsltjtq.supabase.co";
const dbKey = "sb_publishable_hfQrBZ4OYrkHjUxvtzCL_g_mi05THSO";
const NUMERO_LIVRAISON = "2250143812759";

let mySupabase = null;
let toutesDemandes = [];
let tousVendeurs = [];
let tousProduits = [];
let toutesCommandes = [];

function formaterPrix(montant) {
    const n = parseInt(String(montant ?? '0').replace(/\s+/g, ''), 10);
    if (isNaN(n)) return montant;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function echapperHTML(texte) {
    const div = document.createElement('div');
    div.textContent = String(texte ?? '');
    return div.innerHTML;
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

// ---------- CONNEXION ----------
async function connecterAdmin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login');
    const err = document.getElementById('login-erreur');
    err.classList.add('hidden');
    if (!email || !pass) return;

    btn.disabled = true;
    btn.innerText = "Connexion...";
    try {
        const { error } = await mySupabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        await verifierEtLancer();
    } catch (e) {
        err.innerText = "Email ou mot de passe incorrect.";
        err.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = "Se connecter";
    }
}

async function verifierEtLancer() {
    const { data: { session } } = await mySupabase.auth.getSession();
    if (!session) return;

    const { data: estAdmin, error } = await mySupabase.rpc('est_admin');
    if (error || !estAdmin) {
        const err = document.getElementById('login-erreur');
        err.innerText = "Accès refusé.";
        err.classList.remove('hidden');
        await mySupabase.auth.signOut();
        return;
    }

    document.getElementById('ecran-login').classList.add('hidden');
    document.getElementById('app-admin').classList.remove('hidden');
    chargerDemandes();
}

async function deconnecterAdmin() {
    await mySupabase.auth.signOut();
    window.location.reload();
}

// ---------- ONGLETS ----------
function changerOnglet(nom) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === nom));
    ['demandes', 'vendeurs', 'produits', 'commandes', 'contenu', 'stats'].forEach(o => {
        const el = document.getElementById('onglet-' + o);
        if (el) el.classList.toggle('hidden', o !== nom);
    });
    if (nom === 'demandes') chargerDemandes();
    if (nom === 'vendeurs') chargerVendeurs();
    if (nom === 'produits') chargerProduits();
    if (nom === 'commandes') chargerCommandes();
    if (nom === 'contenu') chargerContenu();
    if (nom === 'stats') chargerStats();
}

// ---------- DEMANDES ----------
async function chargerDemandes() {
    const conteneur = document.getElementById('onglet-demandes');
    conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Chargement...</p>';
    const { data, error } = await mySupabase.from('demandes').select('*').order('created_at', { ascending: false });
    if (error) { conteneur.innerHTML = '<p class="text-red-500 text-xs text-center">Erreur de chargement</p>'; return; }
    toutesDemandes = data || [];

    const badge = document.getElementById('badge-nb-demandes');
    const nbAttente = toutesDemandes.filter(d => (d.statut || 'en_attente') === 'en_attente').length;
    if (nbAttente > 0) { badge.innerText = nbAttente; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }

    if (toutesDemandes.length === 0) { conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Aucune demande.</p>'; return; }

    conteneur.innerHTML = toutesDemandes.map(d => {
        const estVip = (d.type === 'upgrade_vip' || d.type === 'vip');
        const typeLabel = d.type === 'boost' ? 'Boost article' : (estVip ? 'Passage VIP' : 'Passage PRO');
        const dateStr = new Date(d.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const statutSafe = d.statut || 'en_attente';
        const actions = statutSafe === 'en_attente' ? `
            <div class="flex gap-2 mt-3">
                <button onclick="traiterDemande('${d.id}', true)" class="flex-1 bg-green-500 text-white text-[11px] font-black py-2 rounded-lg uppercase">Approuver</button>
                <button onclick="traiterDemande('${d.id}', false)" class="flex-1 bg-red-100 text-red-500 text-[11px] font-black py-2 rounded-lg uppercase">Refuser</button>
            </div>` : '';
        return `<div class="carte">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-black text-sm text-gray-800">${echapperHTML(d.nom_boutique || d.vendeur_tel)}</p>
                    <p class="text-[11px] text-gray-400">${typeLabel} • ${dateStr}</p>
                </div>
                <span class="text-[9px] font-black uppercase px-2 py-1 rounded-full badge-${statutSafe}">${statutSafe.replace('_', ' ')}</span>
            </div>
            ${d.message ? `<p class="text-[11px] text-gray-500 mt-2 bg-gray-50 rounded-lg p-2">${echapperHTML(d.message)}</p>` : ''}
            ${actions}
        </div>`;
    }).join('');
}

async function traiterDemande(id, approuver) {
    const demande = toutesDemandes.find(d => String(d.id) === String(id));
    if (!demande) return;
    demanderConfirmationAdmin(approuver ? "Approuver cette demande ?" : "Refuser cette demande ?", async () => {
        try {
            if (approuver) {
                if (demande.type === 'boost' && demande.produit_id) {
                    await mySupabase.from('produits').update({ est_booste: true }).eq('id', demande.produit_id);
                } else if (['upgrade_pro', 'upgrade_vip', 'pro', 'vip'].includes(demande.type)) {
                    const plan = (demande.type === 'upgrade_vip' || demande.type === 'vip') ? 'vip' : 'pro';
                    let vendeur = tousVendeurs.find(v => v.whatsapp === demande.vendeur_tel);
                    if (!vendeur) {
                        const { data } = await mySupabase.from('vendeurs').select('id').eq('whatsapp', demande.vendeur_tel).single();
                        vendeur = data;
                    }
                    if (vendeur) {
                        const { error } = await mySupabase.rpc('admin_definir_abonnement', { p_vendeur_id: vendeur.id, p_plan: plan });
                        if (error) throw error;
                    }
                }
            }
            await mySupabase.from('demandes').update({ statut: approuver ? 'traitee' : 'refusee' }).eq('id', demande.id);
            chargerDemandes();
        } catch (e) { alert("Erreur : " + e.message); }
    });
                    }

// ---------- VENDEURS ----------
async function chargerVendeurs() {
    const conteneur = document.getElementById('liste-vendeurs');
    conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Chargement...</p>';
    const { data, error } = await mySupabase.from('vendeurs').select('id, nom_boutique, proprietaire, whatsapp, abonnement, fin_abonnement, image, photo_couverture, logo, compte_actif, date_inscription').order('date_inscription', { ascending: false });
    if (error) { conteneur.innerHTML = '<p class="text-red-500 text-xs text-center">Erreur</p>'; return; }
    tousVendeurs = data || [];
    afficherVendeurs(tousVendeurs);
}

function afficherVendeurs(liste) {
    const conteneur = document.getElementById('liste-vendeurs');
    if (liste.length === 0) { conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Aucun vendeur.</p>'; return; }
    conteneur.innerHTML = liste.map(v => {
        let infoJours = '';
        if ((v.abonnement === 'pro' || v.abonnement === 'vip') && v.fin_abonnement) {
            const jours = Math.max(0, Math.ceil((new Date(v.fin_abonnement) - new Date()) / (1000 * 60 * 60 * 24)));
            infoJours = `<span class="text-[10px] text-orange-500 font-bold ml-1">(${jours}j restants)</span>`;
        }
        let numWa = String(v.whatsapp || '').replace(/\s+/g, '').replace('+', '');
        if (numWa.length === 10) numWa = '225' + numWa;

        return `
        <div class="carte">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-black text-sm text-gray-800">${echapperHTML(v.nom_boutique)}</p>
                    <p class="text-[11px] text-gray-400">${echapperHTML(v.proprietaire || '')} • ${echapperHTML(v.whatsapp || '')} ${infoJours}</p>
                </div>
                <span class="text-[9px] font-black uppercase px-2 py-1 rounded-full badge-${v.abonnement || 'standard'}">${v.abonnement || 'standard'}</span>
            </div>
            ${v.compte_actif === false ? '<p class="text-[10px] font-black text-red-500 mt-1"><i class="fas fa-ban"></i> COMPTE SUSPENDU</p>' : ''}
            <div class="flex gap-2 mt-3 flex-wrap items-center">
                <select id="plan-${v.id}" class="text-[11px] border rounded-lg px-2 py-1.5 bg-gray-50 font-bold">
                    <option value="standard" ${v.abonnement === 'standard' ? 'selected' : ''}>Standard</option>
                    <option value="pro" ${v.abonnement === 'pro' ? 'selected' : ''}>Pro (30j)</option>
                    <option value="vip" ${v.abonnement === 'vip' ? 'selected' : ''}>Vip (30j)</option>
                </select>
                <button onclick="modifierAbonnement('${v.id}')" class="bg-[#5b21b6] text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase">Appliquer</button>
                <button onclick="toggleCompteVendeur('${v.id}')" class="text-[10px] font-black px-3 py-1.5 rounded-lg uppercase ${v.compte_actif !== false ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}">${v.compte_actif !== false ? 'Suspendre' : 'Réactiver'}</button>
                ${numWa ? `<a href="https://wa.me/${numWa}" target="_blank" class="bg-[#25D366] text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg ml-auto"><i class="fab fa-whatsapp"></i></a>` : ''}
            </div>
        </div>
        `;
    }).join('');
}

function filtrerVendeurs() {
    const q = document.getElementById('recherche-vendeurs').value.toLowerCase();
    afficherVendeurs(tousVendeurs.filter(v => (v.nom_boutique || '').toLowerCase().includes(q) || (v.whatsapp || '').includes(q)));
}

async function modifierAbonnement(id) {
    const plan = document.getElementById('plan-' + id).value;
    demanderConfirmationAdmin(`Passer ce vendeur en ${plan.toUpperCase()} ?`, async () => {
        try {
            const { error } = await mySupabase.rpc('admin_definir_abonnement', { p_vendeur_id: id, p_plan: plan });
            if (error) throw error;
            chargerVendeurs();
        } catch (e) { alert("Erreur : " + e.message); }
    });
}

async function toggleCompteVendeur(id) {
    const v = tousVendeurs.find(x => String(x.id) === String(id));
    demanderConfirmationAdmin(v && v.compte_actif !== false ? "Suspendre ce vendeur ? Ses articles disparaîtront de la vitrine." : "Réactiver ce vendeur ?", async () => {
        try {
            const { error } = await mySupabase.rpc('admin_toggle_compte_actif', { p_vendeur_id: id });
            if (error) throw error;
            chargerVendeurs();
        } catch (e) { alert("Erreur : " + e.message); }
    });
                                  }
        
// ---------- PRODUITS ----------
async function chargerProduits() {
    const conteneur = document.getElementById('liste-produits');
    conteneur.innerHTML = '<p class="col-span-2 text-center text-gray-400 text-xs py-6">Chargement...</p>';
    const { data, error } = await mySupabase.from('produits').select('*').order('dateajout', { ascending: false }).limit(1000);
    if (error) { conteneur.innerHTML = '<p class="col-span-2 text-red-500 text-xs text-center">Erreur</p>'; return; }
    tousProduits = data || [];

    const enAttente = tousProduits.filter(p => p.statut === 'attente');
    const badgeAttente = document.getElementById('badge-nb-attente');
    if (badgeAttente) {
        if (enAttente.length > 0) { badgeAttente.innerText = enAttente.length; badgeAttente.classList.remove('hidden'); }
        else { badgeAttente.classList.add('hidden'); }
    }

    const zoneAValider = document.getElementById('zone-a-valider');
    const listeAValider = document.getElementById('liste-a-valider');
    if (zoneAValider && listeAValider) {
        if (enAttente.length === 0) {
            zoneAValider.classList.add('hidden');
        } else {
            zoneAValider.classList.remove('hidden');
            listeAValider.innerHTML = enAttente.map(p => `
                <div class="carte">
                    <img src="${p.image || ''}" class="w-full h-40 object-cover rounded-xl mb-2" onerror="this.style.display='none'">
                    <p class="font-black text-sm text-gray-800">${echapperHTML(p.nom)}</p>
                    <p class="text-sm text-[#f97316] font-black">${formaterPrix(p.prix)} F</p>
                    <p class="text-[11px] text-gray-400">${echapperHTML(p.categorie || 'Sans rayon')} • ${echapperHTML(p.vendeur)}</p>
                    ${p.description ? `<p class="text-[11px] text-gray-500 mt-2 bg-gray-50 rounded-lg p-2">${echapperHTML(p.description)}</p>` : ''}
                    <div class="flex gap-2 mt-3">
                        <button onclick="traiterProduit('${p.id}', true)" class="flex-1 bg-green-500 text-white text-[11px] font-black py-2 rounded-lg uppercase">Approuver</button>
                        <button onclick="traiterProduit('${p.id}', false)" class="flex-1 bg-red-100 text-red-500 text-[11px] font-black py-2 rounded-lg uppercase">Refuser</button>
                    </div>
                </div>
            `).join('');
        }
    }

    afficherProduitsAdmin(tousProduits.filter(p => p.statut !== 'attente'));
}

async function traiterProduit(id, approuver) {
    demanderConfirmationAdmin(approuver ? "Approuver et publier cet article ?" : "Refuser et supprimer cet article ?", async () => {
        try {
            if (approuver) {
                const { error } = await mySupabase.from('produits').update({ statut: 'actif' }).eq('id', id);
                if (error) throw error;
            } else {
                const prod = tousProduits.find(p => String(p.id) === String(id));
                if (prod && prod.image) await supprimerImageStorage(prod.image);
                const { error } = await mySupabase.from('produits').delete().eq('id', id);
                if (error) throw error;
            }
            chargerProduits();
        } catch (e) { alert("Erreur : " + e.message); }
    });
    }

function afficherProduitsAdmin(liste) {
    const conteneur = document.getElementById('liste-produits');
    if (liste.length === 0) { conteneur.innerHTML = '<p class="col-span-2 text-center text-gray-400 text-xs py-6">Aucun article.</p>'; return; }
    conteneur.innerHTML = liste.map(p => {
        const estBooste = p.est_booste === true;
        const estActif = p.statut === 'actif';
        return `
        <div class="carte !p-2 flex flex-col relative ${estBooste ? 'border-2 border-orange-400' : ''}">
            <span class="absolute top-3 left-3 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded">#${p.id}</span>
            ${!estActif ? '<span class="absolute top-3 right-3 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Pause</span>' : ''}
            <img src="${p.image || ''}" loading="lazy" class="w-full h-24 object-cover rounded-xl mb-1.5 ${!estActif ? 'opacity-50' : ''}" onerror="this.style.display='none'">
            <p class="text-[11px] font-black text-gray-800 truncate">${echapperHTML(p.nom)}</p>
            <p class="text-[11px] text-[#f97316] font-black">${formaterPrix(p.prix)} F</p>
            <p class="text-[10px] text-gray-400 truncate mb-2">${echapperHTML(p.vendeur)}</p>
            <div class="flex gap-1 mt-auto">
                <button onclick="toggleBoostProduitAdmin('${p.id}', ${estBooste})" class="flex-1 ${estBooste ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'} text-[9px] font-black py-1.5 rounded-lg uppercase">
                    <i class="fas fa-fire"></i>
                </button>
                <button onclick="toggleStatutProduitAdmin('${p.id}', '${p.statut}')" class="flex-1 ${estActif ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'} text-[9px] font-black py-1.5 rounded-lg uppercase">
                    <i class="fas ${estActif ? 'fa-pause' : 'fa-check'}"></i>
                </button>
                <button onclick="supprimerProduitAdmin('${p.id}')" class="flex-1 bg-red-50 text-red-500 text-[9px] font-black py-1.5 rounded-lg uppercase">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
    }

function filtrerProduits() {
    const q = document.getElementById('recherche-produits').value.toLowerCase();
    afficherProduitsAdmin(tousProduits.filter(p => p.statut !== 'attente' && (
        (p.nom || '').toLowerCase().includes(q) ||
        String(p.vendeur || '').includes(q) ||
        String(p.id || '').includes(q)
    )));
}

async function toggleBoostProduitAdmin(id, estBoosteActuel) {
    try {
        const { error } = await mySupabase.from('produits').update({ est_booste: !estBoosteActuel }).eq('id', id);
        if (error) throw error;
        chargerProduits();
    } catch (e) { alert("Erreur : " + e.message); }
}

async function toggleStatutProduitAdmin(id, statutActuel) {
    try {
        const nouveau = statutActuel === 'actif' ? 'epuise' : 'actif';
        const { error } = await mySupabase.from('produits').update({ statut: nouveau }).eq('id', id);
        if (error) throw error;
        chargerProduits();
    } catch (e) { alert("Erreur : " + e.message); }
}

async function supprimerProduitAdmin(id) {
    demanderConfirmationAdmin("Supprimer définitivement cet article et sa photo ?", async () => {
        try {
            const prod = tousProduits.find(p => String(p.id) === String(id));
            if (prod && prod.image) await supprimerImageStorage(prod.image);
            const { error } = await mySupabase.from('produits').delete().eq('id', id);
            if (error) throw error;
            chargerProduits();
        } catch (e) { alert("Erreur : " + e.message); }
    });
}

// ---------- COMMANDES ----------
async function chargerCommandes() {
    const conteneur = document.getElementById('onglet-commandes');
    conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Chargement...</p>';
    const { data, error } = await mySupabase.from('commandes').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) { conteneur.innerHTML = '<p class="text-red-500 text-xs text-center">Erreur</p>'; return; }
    toutesCommandes = data || [];
    if (toutesCommandes.length === 0) { conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Aucune commande.</p>'; return; }

    conteneur.innerHTML = toutesCommandes.map(c => {
        const dateStr = new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const itemsTexte = Array.isArray(c.items)
            ? c.items.map(i => `${i.quantite || 1}x ${echapperHTML(i.nom)}`).join(', ')
            : '';
        return `<div class="carte">
            <div class="flex justify-between items-center">
                <p class="font-black text-xs text-[#5b21b6]">Commande #${c.numero_commande}</p>
                <p class="font-black text-xs text-[#f97316]">${formaterPrix(c.total_fcfa)} F</p>
            </div>
            ${itemsTexte ? `<p class="text-[11px] font-bold text-gray-700 mt-1">${itemsTexte}</p>` : ''}
            <p class="text-[11px] text-gray-400 mt-1">Vendeur : ${echapperHTML(c.vendeur_tel)} • ${dateStr}</p>
            <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                <span class="text-[10px] font-bold text-gray-500 uppercase">${echapperHTML(c.mode_reception || '')} ${c.quartier_livraison ? '• ' + echapperHTML(c.quartier_livraison) : ''}</span>
                <button onclick="envoyerLivreurAdmin('${c.numero_commande}')" class="bg-[#25D366] text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                    <i class="fas fa-motorcycle"></i> Livrer
                </button>
            </div>
        </div>`;
    }).join('');
}

function envoyerLivreurAdmin(numeroCmd) {
    const cmd = toutesCommandes.find(c => String(c.numero_commande) === String(numeroCmd));
    if (!cmd) return;
    const quartier = cmd.quartier_livraison || "À préciser";
    const montant = formaterPrix(cmd.total_fcfa);
    const message = encodeURIComponent(`🛵 *DEMANDE DE LIVRAISON #CMD-${numeroCmd}*\n\n📞 *Vendeur :* ${cmd.vendeur_tel}\n📍 *Quartier client :* ${quartier}\n💰 *Montant commande :* ${montant} FCFA`);
    window.open(`https://wa.me/${NUMERO_LIVRAISON}?text=${message}`);
}

// ---------- STATS ----------
async function chargerStats() {
    const conteneur = document.getElementById('onglet-stats');
    conteneur.innerHTML = '<p class="col-span-2 text-center text-gray-400 text-xs py-6">Chargement...</p>';
    const [
        { data: vendeurs },
        { data: produits },
        { data: commandes },
        { count: nbVues },
        { count: nbPaniers }
    ] = await Promise.all([
        mySupabase.from('vendeurs').select('abonnement, compte_actif'),
        mySupabase.from('produits').select('id, statut'),
        mySupabase.from('commandes').select('id, created_at'),
        mySupabase.from('interactions_utilisateurs').select('*', { count: 'exact', head: true }).eq('action', 'vue'),
        mySupabase.from('interactions_utilisateurs').select('*', { count: 'exact', head: true }).eq('action', 'panier')
    ]);
    const nbVendeursActifs = (vendeurs || []).filter(v => v.compte_actif !== false).length;
    const nbPro = (vendeurs || []).filter(v => v.abonnement === 'pro').length;
    const nbVip = (vendeurs || []).filter(v => v.abonnement === 'vip').length;
    const nbProduits = (produits || []).filter(p => p.statut === 'actif').length;
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    const nbCommandesMois = (commandes || []).filter(c => new Date(c.created_at) >= debutMois).length;

    const cartes = [
        ["Vendeurs actifs", nbVendeursActifs],
        ["Comptes PRO", nbPro],
        ["Comptes VIP", nbVip],
        ["Articles en ligne", nbProduits],
        ["Commandes ce mois", nbCommandesMois],
        ["Commandes au total", (commandes || []).length],
        ["Vues d'articles", nbVues || 0],
        ["Ajouts au panier", nbPaniers || 0]
    ];
    conteneur.innerHTML = cartes.map(([label, valeur]) => `
        <div class="carte text-center">
            <p class="text-2xl font-black text-[#5b21b6]">${valeur}</p>
            <p class="text-[10px] text-gray-400 uppercase font-bold mt-1">${label}</p>
        </div>
    `).join('');
}

// ---------- CONTENU ----------
let fichierPubChoisi = null;

async function chargerContenu() {
    const { data: annonce } = await mySupabase.from('annonces').select('*').limit(1).maybeSingle();
    const champAnnonce = document.getElementById('champ-annonce');
    if (champAnnonce) {
        champAnnonce.value = annonce ? (annonce.message || '') : '';
        champAnnonce.dataset.id = annonce ? annonce.id : '';
    }

    const { data: tv } = await mySupabase.from('tv_market').select('*').limit(1).maybeSingle();
    const champTv = document.getElementById('champ-tv-lien');
    const champTvProd = document.getElementById('champ-tv-produit-id');
    if (champTv) {
        champTv.value = tv ? (tv.lien_youtube || '') : '';
        champTv.dataset.id = tv ? tv.id : '';
    }
    if (champTvProd) {
        champTvProd.value = (tv && tv.id_produit) ? tv.id_produit : '';
    }

    const inputPubImg = document.getElementById('champ-pub-image');
    if (inputPubImg) {
        inputPubImg.onchange = (e) => {
            fichierPubChoisi = e.target.files[0] || null;
            document.getElementById('btn-choisir-pub').innerText = fichierPubChoisi ? "Image prête : " + fichierPubChoisi.name : "Choisir une image";
        };
    }

    chargerPublicites();
}

async function enregistrerAnnonce() {
    const champ = document.getElementById('champ-annonce');
    const message = champ.value.trim();
    const id = champ.dataset.id;
    try {
        const { error } = id
            ? await mySupabase.from('annonces').update({ message }).eq('id', id)
            : await mySupabase.from('annonces').insert([{ message }]);
        if (error) throw error;
        alert("Bandeau mis à jour.");
        chargerContenu();
    } catch (e) { alert("Erreur : " + e.message); }
}

async function enregistrerTvMarket(actif) {
    const champ = document.getElementById('champ-tv-lien');
    const champProd = document.getElementById('champ-tv-produit-id');
    const lien_youtube = champ.value.trim();
    const idProdVal = champProd ? champProd.value.trim() : '';
    const id = champ.dataset.id;
    try {
        const maj = {
            lien_youtube,
            id_produit: idProdVal ? parseInt(idProdVal, 10) : null,
            statut: actif ? 'actif' : 'inactif'
        };
        const { error } = id
            ? await mySupabase.from('tv_market').update(maj).eq('id', id)
            : await mySupabase.from('tv_market').insert([maj]);
        if (error) throw error;
        alert(actif ? "Vidéo TV activée." : "Vidéo TV désactivée.");
        chargerContenu();
    } catch (e) { alert("Erreur : " + e.message); }
}

async function chargerPublicites() {
    const conteneur = document.getElementById('liste-publicites');
    if (!conteneur) return;
    conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-3">Chargement...</p>';
    const { data, error } = await mySupabase.from('publicites').select('*').order('created_at', { ascending: false });
    if (error) { conteneur.innerHTML = '<p class="text-red-500 text-xs text-center">Erreur</p>'; return; }
    const liste = data || [];
    window.toutesPublicitesAdmin = liste;
    if (liste.length === 0) { conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-3">Aucune bannière.</p>'; return; }
    conteneur.innerHTML = liste.map(p => `
        <div class="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
            <img src="${p.image || ''}" class="w-14 h-14 object-cover rounded-lg" onerror="this.style.display='none'">
            <div class="flex-1">
                <p class="text-[11px] font-black text-gray-600">Article #${p.id_produit || '—'}</p>
                <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${p.statut === 'actif' ? 'badge-vip' : 'badge-standard'}">${p.statut}</span>
            </div>
            <button onclick="togglePublicite('${p.id}', '${p.statut}')" class="text-[10px] font-black px-2 py-1.5 rounded-lg uppercase bg-gray-200 text-gray-600">${p.statut === 'actif' ? 'Désactiver' : 'Activer'}</button>
            <button onclick="supprimerPublicite('${p.id}')" class="text-[10px] font-black px-2 py-1.5 rounded-lg uppercase bg-red-100 text-red-500">Suppr.</button>
        </div>
    `).join('');
}

async function ajouterPublicite() {
    const idProduit = document.getElementById('champ-pub-produit-id').value.trim();
    const btn = document.getElementById('btn-ajouter-pub');
    if (!fichierPubChoisi) { alert("Choisis d'abord une image."); return; }
    if (btn) { btn.disabled = true; btn.innerText = "Envoi en cours..."; }
    try {
        const optionsCompression = { maxSizeMB: 0.2, maxWidthOrHeight: 1024, useWebWorker: true, fileType: 'image/webp' };
        const imageCompressee = (typeof imageCompression !== 'undefined')
            ? await imageCompression(fichierPubChoisi, optionsCompression)
            : fichierPubChoisi;
        const nomFichier = "pub_" + Date.now() + ".webp";
        const { error: errUpload } = await mySupabase.storage.from('images').upload(nomFichier, imageCompressee);
        if (errUpload) throw errUpload;
        const { data: { publicUrl } } = mySupabase.storage.from('images').getPublicUrl(nomFichier);

        const { error } = await mySupabase.from('publicites').insert([{
            image: publicUrl,
            id_produit: idProduit ? parseInt(idProduit, 10) : null,
            statut: 'actif'
        }]);
        if (error) throw error;

        fichierPubChoisi = null;
        document.getElementById('champ-pub-produit-id').value = '';
        document.getElementById('champ-pub-image').value = '';
        document.getElementById('btn-choisir-pub').innerText = "Choisir une image";
        chargerPublicites();
    } catch (e) {
        alert("Erreur : " + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Ajouter la bannière"; }
    }
}

async function togglePublicite(id, statutActuel) {
    try {
        const { error } = await mySupabase.from('publicites').update({ statut: statutActuel === 'actif' ? 'inactif' : 'actif' }).eq('id', id);
        if (error) throw error;
        chargerPublicites();
    } catch (e) { alert("Erreur : " + e.message); }
}

async function supprimerPublicite(id) {
    demanderConfirmationAdmin("Supprimer cette bannière ?", async () => {
        try {
            const pub = (window.toutesPublicitesAdmin || []).find(p => String(p.id) === String(id));
            if (pub && pub.image) await supprimerImageStorage(pub.image);
            const { error } = await mySupabase.from('publicites').delete().eq('id', id);
            if (error) throw error;
            chargerPublicites();
        } catch (e) { alert("Erreur : " + e.message); }
    });
}

// ---------- CONFIRMATION ----------
function demanderConfirmationAdmin(texte, callback) {
    document.getElementById('confirm-texte').innerText = texte;
    document.getElementById('modale-confirm').classList.remove('hidden');
    const btn = document.getElementById('btn-confirm-oui');
    btn.onclick = () => { fermerConfirmAdmin(); callback(); };
}
function fermerConfirmAdmin() {
    document.getElementById('modale-confirm').classList.add('hidden');
}

// ---------- DEMARRAGE ----------
(async function demarrerAdmin() {
    if (typeof window.supabase === 'undefined') return;
    mySupabase = window.supabase.createClient(dbUrl, dbKey);
    const { data: { session } } = await mySupabase.auth.getSession();
    if (session) await verifierEtLancer();
})();

window.connecterAdmin = connecterAdmin;
window.deconnecterAdmin = deconnecterAdmin;
window.changerOnglet = changerOnglet;
window.traiterDemande = traiterDemande;
window.modifierAbonnement = modifierAbonnement;
window.toggleCompteVendeur = toggleCompteVendeur;
window.filtrerVendeurs = filtrerVendeurs;
window.filtrerProduits = filtrerProduits;
window.traiterProduit = traiterProduit;
window.toggleBoostProduitAdmin = toggleBoostProduitAdmin;
window.toggleStatutProduitAdmin = toggleStatutProduitAdmin;
window.supprimerProduitAdmin = supprimerProduitAdmin;
window.envoyerLivreurAdmin = envoyerLivreurAdmin;
window.fermerConfirmAdmin = fermerConfirmAdmin;
window.enregistrerAnnonce = enregistrerAnnonce;
window.enregistrerTvMarket = enregistrerTvMarket;
window.ajouterPublicite = ajouterPublicite;
window.togglePublicite = togglePublicite;
window.supprimerPublicite = supprimerPublicite;
        
