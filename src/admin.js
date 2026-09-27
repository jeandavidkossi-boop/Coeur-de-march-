const dbUrl = "https://szhxxohizqnwcmsltjtq.supabase.co";
const dbKey = "sb_publishable_hfQrBZ4OYrkHjUxvtzCL_g_mi05THSO";

let mySupabase = null;
let toutesDemandes = [];
let tousVendeurs = [];
let tousProduits = [];

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
    ['demandes', 'vendeurs', 'produits', 'commandes', 'stats'].forEach(o => {
        document.getElementById('onglet-' + o).classList.toggle('hidden', o !== nom);
    });
    if (nom === 'demandes') chargerDemandes();
    if (nom === 'vendeurs') chargerVendeurs();
    if (nom === 'produits') chargerProduits();
    if (nom === 'commandes') chargerCommandes();
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
    const nbAttente = toutesDemandes.filter(d => d.statut === 'en_attente').length;
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
    const { data, error } = await mySupabase.from('vendeurs').select('*').order('date_inscription', { ascending: false });
    if (error) { conteneur.innerHTML = '<p class="text-red-500 text-xs text-center">Erreur</p>'; return; }
    tousVendeurs = data || [];
    afficherVendeurs(tousVendeurs);
}

function afficherVendeurs(liste) {
    const conteneur = document.getElementById('liste-vendeurs');
    if (liste.length === 0) { conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Aucun vendeur.</p>'; return; }
    conteneur.innerHTML = liste.map(v => `
        <div class="carte">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-black text-sm text-gray-800">${echapperHTML(v.nom_boutique)}</p>
                    <p class="text-[11px] text-gray-400">${echapperHTML(v.proprietaire || '')} • ${echapperHTML(v.whatsapp || '')}</p>
                </div>
                <span class="text-[9px] font-black uppercase px-2 py-1 rounded-full badge-${v.abonnement || 'standard'}">${v.abonnement || 'standard'}</span>
            </div>
            ${v.compte_actif === false ? '<p class="text-[10px] font-black text-red-500 mt-1"><i class="fas fa-ban"></i> COMPTE SUSPENDU</p>' : ''}
            <div class="flex gap-2 mt-3 flex-wrap items-center">
                <select id="plan-${v.id}" class="text-[11px] border rounded-lg px-2 py-1.5">
                    <option value="standard" ${v.abonnement === 'standard' ? 'selected' : ''}>Standard</option>
                    <option value="pro" ${v.abonnement === 'pro' ? 'selected' : ''}>Pro (30j)</option>
                    <option value="vip" ${v.abonnement === 'vip' ? 'selected' : ''}>Vip (30j)</option>
                </select>
                <button onclick="modifierAbonnement('${v.id}')" class="bg-[#5b21b6] text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase">Appliquer</button>
                <button onclick="toggleCompteVendeur('${v.id}')" class="text-[10px] font-black px-3 py-1.5 rounded-lg uppercase ${v.compte_actif !== false ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}">${v.compte_actif !== false ? 'Suspendre' : 'Réactiver'}</button>
            </div>
        </div>
    `).join('');
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
    const { data, error } = await mySupabase.from('produits').select('*').order('dateajout', { ascending: false }).limit(200);
    if (error) { conteneur.innerHTML = '<p class="col-span-2 text-red-500 text-xs text-center">Erreur</p>'; return; }
    tousProduits = data || [];
    afficherProduitsAdmin(tousProduits);
}

function afficherProduitsAdmin(liste) {
    const conteneur = document.getElementById('liste-produits');
    if (liste.length === 0) { conteneur.innerHTML = '<p class="col-span-2 text-center text-gray-400 text-xs py-6">Aucun article.</p>'; return; }
    conteneur.innerHTML = liste.map(p => `
        <div class="carte !p-2">
            <img src="${p.image || ''}" class="w-full h-24 object-cover rounded-xl mb-1.5" onerror="this.style.display='none'">
            <p class="text-[11px] font-black text-gray-800 truncate">${echapperHTML(p.nom)}</p>
            <p class="text-[11px] text-[#f97316] font-black">${formaterPrix(p.prix)} F</p>
            <p class="text-[10px] text-gray-400 truncate mb-1.5">${echapperHTML(p.vendeur)}</p>
            <button onclick="supprimerProduitAdmin('${p.id}')" class="w-full bg-red-50 text-red-500 text-[10px] font-black py-1.5 rounded-lg uppercase">Supprimer</button>
        </div>
    `).join('');
}

function filtrerProduits() {
    const q = document.getElementById('recherche-produits').value.toLowerCase();
    afficherProduitsAdmin(tousProduits.filter(p => (p.nom || '').toLowerCase().includes(q) || (p.vendeur || '').includes(q)));
}

async function supprimerProduitAdmin(id) {
    demanderConfirmationAdmin("Supprimer définitivement cet article ?", async () => {
        try {
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
    const commandes = data || [];
    if (commandes.length === 0) { conteneur.innerHTML = '<p class="text-center text-gray-400 text-xs py-6">Aucune commande.</p>'; return; }
    conteneur.innerHTML = commandes.map(c => {
        const dateStr = new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `<div class="carte">
            <div class="flex justify-between">
                <p class="font-black text-xs text-gray-800">Commande #${c.numero_commande}</p>
                <p class="font-black text-xs text-[#f97316]">${formaterPrix(c.total_fcfa)} F</p>
            </div>
            <p class="text-[11px] text-gray-400 mt-1">Vendeur : ${echapperHTML(c.vendeur_tel)} • ${dateStr}</p>
            <p class="text-[11px] text-gray-400">${echapperHTML(c.mode_reception || '')} ${c.quartier_livraison ? '• ' + echapperHTML(c.quartier_livraison) : ''}</p>
        </div>`;
    }).join('');
}

// ---------- STATS ----------
async function chargerStats() {
    const conteneur = document.getElementById('onglet-stats');
    conteneur.innerHTML = '<p class="col-span-2 text-center text-gray-400 text-xs py-6">Chargement...</p>';
    const [{ data: vendeurs }, { data: produits }, { data: commandes }] = await Promise.all([
        mySupabase.from('vendeurs').select('abonnement, compte_actif'),
        mySupabase.from('produits').select('id, statut'),
        mySupabase.from('commandes').select('id, created_at')
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
        ["Commandes au total", (commandes || []).length]
    ];
    conteneur.innerHTML = cartes.map(([label, valeur]) => `
        <div class="carte text-center">
            <p class="text-2xl font-black text-[#5b21b6]">${valeur}</p>
            <p class="text-[10px] text-gray-400 uppercase font-bold mt-1">${label}</p>
        </div>
    `).join('');
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
window.supprimerProduitAdmin = supprimerProduitAdmin;
window.fermerConfirmAdmin = fermerConfirmAdmin;
