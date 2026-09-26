let estEnInscription = false;

const dbUrlGlobal = "https://szhxxohizqnwcmsltjtq.supabase.co";
const dbKeyGlobal = "sb_publishable_hfQrBZ4OYrkHjUxvtzCL_g_mi05THSO";
const supabaseGlobal = window.supabase ? window.supabase.createClient(dbUrlGlobal, dbKeyGlobal) : null;

function modeI() {
    estEnInscription = true;
    document.getElementById('champs-inscription').style.display = 'block';
    document.getElementById('form-titre').innerText = "Inscription nouveau vendeur";
    document.getElementById('btnAction').innerText = "Créer ma boutique";
    document.getElementById('swInsc').className = "text-cdm-purple font-bold text-xs uppercase border-b-2 border-cdm-orange pb-1";
    document.getElementById('swConn').className = "text-gray-400 font-bold text-xs uppercase pb-1";
}

function modeC() {
    estEnInscription = false;
    document.getElementById('champs-inscription').style.display = 'none';
    document.getElementById('form-titre').innerText = "Connectez-vous à votre boutique";
    document.getElementById('btnAction').innerText = "Se connecter";
    document.getElementById('swConn').className = "text-cdm-purple font-bold text-xs uppercase border-b-2 border-cdm-orange pb-1";
    document.getElementById('swInsc').className = "text-gray-400 font-bold text-xs uppercase pb-1";
}

function alertePro(message) {
    const n = document.getElementById('notif-custom');
    if (!n) return;
    n.innerText = message;
    n.classList.add('active');
    setTimeout(() => { n.classList.remove('active'); }, 3000);
}

window.alert = function(msg) {
    alertePro(msg);
};

function nettoyerTelephone(tel) {
    return String(tel || '').replace(/\s+/g, '').replace('+', '').trim();
}

function afficherModal() {
    if (document.getElementById('mon-modal')) return;
    const div = document.createElement('div');
    div.id = 'mon-modal';
    div.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;";
    div.innerHTML = `<div style="background:white; padding:20px; border-radius:20px; width:100%; max-width:300px; text-align:center;">
        <h3 style="margin-bottom:15px; font-weight:bold;">Nouveau mot de passe</h3>
        <input type="password" id="nouveau-mdp" placeholder="6 caractères minimum" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:10px; margin-bottom:15px;">
        <button id="btn-valider" style="width:100%; background:#f97316; color:white; padding:10px; border-radius:10px; border:none; font-weight:bold;">Enregistrer</button>
    </div>`;
    document.body.appendChild(div);
    document.getElementById('btn-valider').onclick = async () => {
        const mdp = document.getElementById('nouveau-mdp').value;
        if (mdp.length < 6) return alert("Minimum 6 caractères");
        const { error } = await supabaseGlobal.auth.updateUser({ password: mdp });
        if (error) alert("Erreur : " + error.message);
        else { alert("Succès !"); window.location.href = "bureau.html"; }
    };
}

window.addEventListener('load', async () => {
    if (window.location.hash.includes('type=recovery')) {
        afficherModal();
        return;
    }
    if (supabaseGlobal) {
        const { data: { session } } = await supabaseGlobal.auth.getSession();
        if (session) {
            window.location.href = "bureau.html";
        }
    }
});

if (supabaseGlobal) {
    supabaseGlobal.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') afficherModal();
    });
}

async function motDePasseOublie() {
    const email = document.getElementById('email').value.trim();

    if (!email) {
        alert("Veuillez d'abord saisir votre adresse email dans le champ ci-dessus.");
        return;
    }

    if (!supabaseGlobal) {
        alert("Le système est en cours de chargement. Réessayez.");
        return;
    }

    const btn = document.getElementById('btnAction');
    btn.innerText = "Envoi du mail...";

    const { error } = await supabaseGlobal.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://jeandavidkossi-boop.github.io/Coeur-de-march-/vendre.html'
    });

    if (error) {
        alert("Erreur : " + error.message);
    } else {
        alert("Vérifiez votre boîte mail ! Un lien de réinitialisation a été envoyé.");
    }

    btn.innerText = estEnInscription ? "Créer ma boutique" : "Se connecter";
}

async function executerAction() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('btnAction');

    if (!email || !pass) {
        alert("L'email et le mot de passe sont obligatoires !");
        return;
    }

    if (!supabaseGlobal) {
        alert("Le système de base de données est en cours de chargement. Veuillez patienter.");
        return;
    }

    btn.innerText = "Traitement en cours...";
    btn.disabled = true;

    try {
        if (estEnInscription) {
            const nomB = document.getElementById('nomB').value.trim();
            const nomP = document.getElementById('nomP').value.trim();
            const tel = nettoyerTelephone(document.getElementById('telephone').value);

            if (!nomB || !nomP || !tel) {
                alert("Veuillez remplir TOUTES les informations (Nom, Propriétaire, WhatsApp).");
                btn.innerText = "Créer ma boutique";
                btn.disabled = false;
                return;
            }

            const { data, error: authError } = await supabaseGlobal.auth.signUp({
                email: email,
                password: pass
            });

            if (authError) {
                alert("Erreur d'inscription : " + authError.message);
                btn.innerText = "Créer ma boutique";
            } else if (data.user) {
                const { error: dbError } = await supabaseGlobal.from('vendeurs').insert([
                    {
                        id: data.user.id,
                        nom_boutique: nomB,
                        proprietaire: nomP,
                        whatsapp: tel,
                        email: email,
                        abonnement: 'standard'
                    }
                ]);

                if (dbError) {
                    alert("Erreur d'enregistrement : " + dbError.message);
                    btn.innerText = "Créer ma boutique";
                } else if (data.session) {
                    alert("Félicitations ! Votre boutique est prête.");
                    setTimeout(() => { window.location.href = "bureau.html"; }, 1200);
                } else {
                    alert("Félicitations ! Votre boutique est créée. Connectez-vous maintenant.");
                    modeC();
                }
            }
        } else {
            const { error } = await supabaseGlobal.auth.signInWithPassword({
                email: email,
                password: pass
            });

            if (error) {
                alert("Identifiants incorrects.");
                btn.innerText = "Se connecter";
            } else {
                window.location.href = "bureau.html";
            }
        }
    } finally {
        btn.disabled = false;
    }
}

window.alertePro = alertePro;
window.afficherModal = afficherModal;
window.modeI = modeI;
window.executerAction = executerAction;
window.modeC = modeC;
window.motDePasseOublie = motDePasseOublie;
    
