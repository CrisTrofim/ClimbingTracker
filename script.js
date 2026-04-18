const firebaseConfig = {
  apiKey: "AIzaSyAhPqDCcq42FzYnkyGvzJTFX1U3cYqHYE8",
  authDomain: "climbingtracker-d0c24.firebaseapp.com",
  databaseURL: "https://climbingtracker-d0c24-default-rtdb.firebaseio.com",
  projectId: "climbingtracker-d0c24",
  storageBucket: "climbingtracker-d0c24.firebasestorage.app",
  messagingSenderId: "490789229720",
  appId: "1:490789229720:web:9a97027005173d05066ced"
};

const SYSTEM_CONFIG = {
    rosebloc: { max: 24, labels: Array.from({length: 25}, (_, i) => i) },
    vscale: { 
        max: 20, 
        labels: ["-", "-", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18"] 
    },
    french: { 
        max: 20, 
        labels: ["-", "4", "5", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "9a", "9a+"] 
    }
};

function refreshAllData() {
    updateRecords(allClimbs);
    initCharts(allClimbs);
}

// Fonction utilitaire pour adapter le score numérique au système d'affichage
function convertForDisplay(score, targetSystem) {
    return score; 
}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let allClimbs = [];
let progressionChart, difficultyChart;

function convertToNumeric(grade, system, isComp = false, targetDisplaySystem = "rosebloc") {
    let g = parseInt(grade) || 1;

    // Si on est en système Rosebloc, on garde le chiffre brut (pas de conversion compé)
    if (system === "rosebloc") {
        // Exception : Si on veut afficher en V-Scale ou Français, on DOIT convertir le compé en normal d'abord
        if (isComp && targetDisplaySystem !== "rosebloc") {
            const refinedMap = {
                1:1, 2:2, 3:3, 4:3, 5:4, 6:4, 7:5, 8:5, 9:6, 10:6, 11:6, 
                12:7, 13:7, 14:8, 15:8, 16:9, 17:9, 18:10, 19:11, 20:12, 21:13, 22:14
            };
            return refinedMap[g] || (g > 22 ? g - 8 : g);
        }
        return g; 
    }
    
    if (system === "vscale") {
        let vNum = parseInt(grade.toString().replace("V", "")) || 0;
        return vNum + 2; 
    }
    
    if (system === "french") {
        const frenchLabels = ["-", "4", "5", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "9a", "9a+"];
        const idx = frenchLabels.indexOf(grade);
        return idx !== -1 ? idx : 1;
    }
    return g;
}

// --- AUTH ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        if (typeof google !== 'undefined') initAutocomplete();
        fetchClimbs();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

document.getElementById('loginBtn').onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
};
document.getElementById('logoutBtn').onclick = () => auth.signOut();

function initAutocomplete() {
    const input = document.getElementById('location');
    new google.maps.places.Autocomplete(input);
}

function updateGradeInput() {
    const sys = document.getElementById('gradeSystem').value;
    const gInput = document.getElementById('grade');
    gInput.type = (sys === "rosebloc") ? "number" : "text";
    gInput.placeholder = (sys === "rosebloc") ? "1-16" : (sys === "vscale" ? "V5" : "7a");
}

async function fetchClimbs() {
    db.ref(`users_climbs/${currentUser.uid}`).on('value', snap => {
        const data = snap.val();
        allClimbs = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        allClimbs.sort((a, b) => new Date(a.date) - new Date(b.date));
        refreshAllData(); // Appel groupé
        displayClimbs(allClimbs);
    });
}

function updateRecords(data) {
    const displaySys = document.getElementById('displaySystem')?.value || 'rosebloc';
    const config = SYSTEM_CONFIG[displaySys];
    
    const normalClimbs = data.filter(d => !d.isComp);
    const compClimbs = data.filter(d => d.isComp);

    const getBestGradeFormatted = (list) => {
        if (!list.length) return "--";
        
        // On cherche l'élément qui a le score numérique le plus élevé
        const bestItem = list.reduce((prev, current) => {
            // Pour la comparaison pure, on utilise la logique standard
            return (convertToNumeric(prev.grade, prev.system, prev.isComp, displaySys) > 
                    convertToNumeric(current.grade, current.system, current.isComp, displaySys)) ? prev : current;
        });

        // Conversion du score de l'item choisi vers le système d'affichage cible
        let numericScore = convertToNumeric(bestItem.grade, bestItem.system, bestItem.isComp, displaySys);
        return config.labels[Math.round(numericScore)] || bestItem.grade;
    };

    const bestNormal = getBestGradeFormatted(normalClimbs);
    const bestComp = getBestGradeFormatted(compClimbs);

    document.getElementById('best-normal').innerHTML = bestNormal !== "--" ? `⭐ ${bestNormal}` : "--";
    document.getElementById('best-comp').innerHTML = bestComp !== "--" ? `🔥 ${bestComp}` : "--";
}

function initCharts(data) {
    const ctxProg = document.getElementById('progressionChart');
    const ctxDiff = document.getElementById('difficultyChart');
    
    // Récupérer le système choisi
    const displaySys = document.getElementById('displaySystem')?.value || 'rosebloc';
    const config = SYSTEM_CONFIG[displaySys];

    if (progressionChart) progressionChart.destroy();
    if (difficultyChart) difficultyChart.destroy();

    const labels = data.map(d => d.date.split('-').slice(1).reverse().join('/'));

    // 1. Préparation des données de progression
    const normalScores = data.map(d => {
        if (d.isComp) return null;
        // On précise displaySys à la fin
        let score = convertToNumeric(d.grade, d.system || "rosebloc", false, displaySys);
        return convertForDisplay(score, displaySys);
    });

    const compScores = data.map(d => {
        if (!d.isComp) return null;
        // On précise displaySys à la fin
        let score = convertToNumeric(d.grade, d.system || "rosebloc", true, displaySys);
        return convertForDisplay(score, displaySys);
    });

    progressionChart = new Chart(ctxProg, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Normal',
                    data: normalScores,
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.3,
                    fill: true,
                    spanGaps: true
                },
                {
                    label: 'Compétition (Ajusté)',
                    data: compScores,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    pointStyle: 'rectRot',
                    pointRadius: 6,
                    tension: 0.3,
                    fill: true,
                    spanGaps: true
                }
            ]
        },
        options: { 
            maintainAspectRatio: false, 
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            let val = context.parsed.y;
                            // On récupère le nom du grade selon le système choisi
                            let gradeName = config.labels[val] || val;
                            return `${label}: ${gradeName}`;
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: false, 
                    min: 0, 
                    max: config.max, // Utilise 24 pour Rosebloc, 18 pour V-Scale
                    ticks: { 
                        stepSize: 1,
                        callback: function(value) {
                            return config.labels[value] || value; // Affiche "V7" ou "7a" sur l'axe
                        }
                    } 
                } 
            } 
        }
    });

    // 2. Préparation des données de répartition (Barres)
    const countsNormal = Array(config.max + 1).fill(0);
    const countsComp = Array(config.max + 1).fill(0);
    
    data.forEach(d => {
        // On applique ici AUSSI la logique : pas de conversion si displaySys est rosebloc
        let scoreRaw = convertToNumeric(d.grade, d.system || "rosebloc", d.isComp, displaySys);
        let scoreDisplay = Math.round(convertForDisplay(scoreRaw, displaySys));
        
        if (scoreDisplay >= 0 && scoreDisplay <= config.max) {
            if (d.isComp) countsComp[scoreDisplay]++;
            else countsNormal[scoreDisplay]++;
        }
    });

    difficultyChart = new Chart(ctxDiff, {
        type: 'bar',
        data: {
            labels: config.labels,
            datasets: [
                { label: 'Normal', data: countsNormal, backgroundColor: '#2ecc71', borderRadius: 5 },
                { label: 'Compétition', data: countsComp, backgroundColor: '#e74c3c', borderRadius: 5 }
            ]
        },
        options: { 
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

const processImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 600 / img.width;
                canvas.width = 600; canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

document.getElementById('climbForm').onsubmit = async (e) => {
    showToast("Grimpe enregistrée ! ✅");
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;

    const imgData = document.getElementById('photo').files[0] ? await processImage(document.getElementById('photo').files[0]) : "";

    const newClimb = {
        location: document.getElementById('location').value,
        system: document.getElementById('gradeSystem').value,
        grade: document.getElementById('grade').value,
        date: document.getElementById('date').value,
        color: document.getElementById('color').value,
        tries: parseInt(document.getElementById('tries').value),
        isComp: document.getElementById('isComp').checked,
        photo: imgData
    };

    await db.ref(`users_climbs/${currentUser.uid}`).push(newClimb);
    e.target.reset();
    btn.disabled = false;
};

function displayClimbs(data) {
    const list = document.getElementById('climbList');
    list.innerHTML = "";
    const colorMap = { "Jaune": "#FFD700", "Orange": "#FF8C00", "Vert": "#2ecc71", "Turquoise": "#40E0D0", "Bleu": "#3498db", "Rouge": "#e74c3c", "Rose": "#ff9ff3", "Noir": "#2d3436", "Blanc": "#ffffff", "Mauve": "#9b59b6" };

    [...data].reverse().forEach(climb => {
        const div = document.createElement('div');
        div.className = `climb-item ${climb.isComp ? 'comp-session' : ''}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <small style="color:#888">${climb.date} • ${climb.location || 'Lieu inconnu'}</small><br>
                    <span class="color-dot" style="background:${colorMap[climb.color] || '#ccc'}"></span>
                    <b>${climb.grade}</b> <small>(${climb.tries} essais)</small>
                    ${climb.isComp ? '<span class="badge-comp">COMPÉ</span>' : ''}
                </div>
                <button onclick="deleteClimb('${climb.id}')" style="padding:5px 10px; background:#ff4757; font-size:10px; width:auto">Supprimer</button>
            </div>
            ${climb.photo ? `<img src="${climb.photo}" style="width:100%; border-radius:12px; margin-top:10px;">` : ''}
        `;
        list.appendChild(div);
    });
}

let climbToDelete = null; // Variable temporaire pour stocker l'ID

function deleteClimb(id) {
    climbToDelete = id; // On mémorise l'ID à supprimer
    document.getElementById('custom-modal').style.display = 'flex';
}

// Gestion des boutons de la modale
document.getElementById('cancelDelete').onclick = () => {
    document.getElementById('custom-modal').style.display = 'none';
    climbToDelete = null;
};

document.getElementById('confirmDelete').onclick = () => {
    if (climbToDelete) {
        db.ref(`users_climbs/${currentUser.uid}/${climbToDelete}`).remove();
        document.getElementById('custom-modal').style.display = 'none';
        climbToDelete = null;
    }
};

// Fermer si on clique à l'extérieur de la carte
window.onclick = (event) => {
    const modal = document.getElementById('custom-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

function updateCharts(range) {
    const days = { '1w': 7, '1m': 30, '6m': 180, '1y': 365 };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days[range] || 9999));
    const filtered = range === 'all' ? allClimbs : allClimbs.filter(d => new Date(d.date) >= cutoff);
    
    document.querySelectorAll('.filter-buttons button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    initCharts(filtered);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    // Définit l'icône selon le type
    const icon = type === 'success' ? '✅' : 'ℹ️';
    
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icon} ${message}</span>`;
    
    container.appendChild(toast);

    // Animation de sortie et suppression après 3 secondes
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// MISE À JOUR : Modifie le bouton de confirmation de suppression pour inclure le toast
document.getElementById('confirmDelete').onclick = () => {
    if (climbToDelete) {
        db.ref(`users_climbs/${currentUser.uid}/${climbToDelete}`).remove()
            .then(() => {
                showToast("Grimpe supprimée avec succès");
            })
            .catch((error) => {
                showToast("Erreur lors de la suppression", "error");
            });
        
        document.getElementById('custom-modal').style.display = 'none';
        climbToDelete = null;
    }
};

// Optionnel : Tu peux aussi l'ajouter dans ton formulaire après l'ajout réussi
// Dans document.getElementById('climbForm').onsubmit :
// showToast("Grimpe enregistrée !");