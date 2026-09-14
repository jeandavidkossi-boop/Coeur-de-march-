let estEnInscription = false;

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
        n.innerText = message;
        n.classList.add('active');
        setTimeout(() => { n.classList.remove('active'); }, 3000);
    }

    window.alert = function(msg) {
        alertePro(msg);
    };

// --- DÉTECTEUR AUTOMATIQUE DE RETOUR D'EMAIL ---
const dbUrlGlobal = import.meta.env.VITE_SUPABASE_URL;
const dbKeyGlobal = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseGlobal = window.supabase.createClient(dbUrlGlobal, dbKeyGlobal);

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
    else { alert("Succès !"); window.location.href = "vendre.html"; }
  };
}

// Vérification immédiate au chargement
window.addEventListener('load', () => {
  if (window.location.hash.includes('type=recovery')) afficherModal();
});

supabaseGlobal.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') afficherModal();
});
// ------------------------------------------------

        async function motDePasseOublie() {
  const email = document.getElementById('email').value;

  if (!email) {
    alert("Veuillez d'abord saisir votre adresse email dans le champ ci-dessus.");
    return;
  }

  // Initialisation de Supabase avec ta clé
  const dbUrl = import.meta.env.VITE_SUPABASE_URL;
  const dbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = window.supabase.createClient(dbUrl, dbKey);

  const btn = document.getElementById('btnAction');
  btn.innerText = "Envoi du mail...";

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://jeandavidkossi-boop.github.io/Coeur-de-march-/vendre.html'
});

  if (error) {
    alert("Erreur : " + error.message);
  } else {
    alert("Vérifiez votre boîte mail ! Un lien de réinitialisation a été envoyé.");
  }

  btn.innerText = "SE CONNECTER";
        }

        async function executerAction() {
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            const btn = document.getElementById('btnAction');

            // 1. Vérification de base
            if(!email || !pass) {
                alert("L'email et le mot de passe sont obligatoires !");
                return;
            }

            // 2. Vérification anti-crash : on s'assure que Supabase est bien réveillé
            if (typeof window.supabase === 'undefined') {
                alert("Le système de base de données est en cours de chargement. Veuillez patienter une seconde et réessayer.");
                return;
            }

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

            btn.innerText = "Traitement en cours...";

            if(estEnInscription) {
                const nomB = document.getElementById('nomB').value;
                const nomP = document.getElementById('nomP').value;
                const tel = document.getElementById('telephone').value;

                // Vérification stricte des champs obligatoires
                if(!nomB || !nomP || !tel) {
                    alert("Veuillez remplir TOUTES les informations (Nom, Propriétaire, WhatsApp).");
                    btn.innerText = "Créer ma boutique";
                    return;
                }

                // A. Création du compte sécurisé
                const { data, error: authError } = await supabase.auth.signUp({
                    email: email,
                    password: pass
                });

                if(authError) {
                    alert("Erreur d'inscription : " + authError.message);
                    btn.innerText = "Créer ma boutique";
                } else if (data.user) {

                    // B. Envoi des informations dans ta table "vendeurs"
                    const { error: dbError } = await supabase.from('vendeurs').insert([
                        {
                            id: data.user.id,
                            nom_boutique: nomB,
                            proprietaire: nomP,
                            whatsapp: tel,
                            email: email,
                            abonnement: 'standard'
                        }
                    ]);

                    if(dbError) {
                        alert("Erreur d'enregistrement dans la table : " + dbError.message);
                        btn.innerText = "Créer ma boutique";
                    } else {
                        alert("Félicitations ! Votre boutique est créée. Connectez-vous maintenant.");
                        modeC();
                    }
                }
            } else {
                // CONNEXION CLASSIQUE
                const { error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: pass
                });

                if(error) {
                    alert("Identifiants incorrects.");
                    btn.innerText = "Se connecter";
                } else {
                    window.location.href = "bureau.html"; // Redirection vers le bureau
                }
            }
        }


// Expose functions to global scope for inline event listeners
window.alertePro = alertePro;
window.afficherModal = afficherModal;
window.modeI = modeI;
window.executerAction = executerAction;
window.modeC = modeC;
window.motDePasseOublie = motDePasseOublie;
