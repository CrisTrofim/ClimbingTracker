const firebaseConfig = {
  apiKey: "AIzaSyAhPqDCcq42FzYnkyGvzJTFX1U3cYqHYE8",
  authDomain: "climbingtracker-d0c24.firebaseapp.com",
  databaseURL: "https://climbingtracker-d0c24-default-rtdb.firebaseio.com",
  projectId: "climbingtracker-d0c24",
  storageBucket: "climbingtracker-d0c24.firebasestorage.app",
  messagingSenderId: "490789229720",
  appId: "1:490789229720:web:9a97027005173d05066ced"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let allClimbs = [];
let progressionChart, difficultyChart;

function convertToNumeric(grade, system, isComp = false) {
    let g = parseInt(grade) || 1;

    if (system === "rosebloc") {
        if (isComp) {
            // Ton échelle raffinée : Compétition -> Équivalent Normal
            const refinedMap = {
                1:1, 2:2, 3:3, 4:3, 5:4, 6:4, 7:5, 8:5, 9:6, 10:6, 11:6, 
                12:7, 13:7, 14:8, 15:8, 16:9, 17:9, 18:10, 19:11, 20:12, 21:13, 22:14
            };
            return refinedMap[g] || (g > 22 ? g - 8 : g);
        }
        return g; // Si c'est normal, on retourne le chiffre tel quel
    }
    
    // Conversion V-Scale vers score numérique Rosebloc (V0 = 2)
    if (system === "vscale") {
        let vNum = parseInt(grade.toString().replace("V", "")) || 0;
        return vNum + 2; 
    }
    
    // Conversion Français (approximation pour le graphique)
    if (system === "french") {
        const frenchLabels = ["4","5","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","9a"];
        const idx = frenchLabels.indexOf(grade);
        return idx !== -1 ? idx + 1 : 1;
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
        updateRecords(allClimbs);
        displayClimbs(allClimbs);
        initCharts(allClimbs);
    });
}

function updateRecords(data) {
    const normalClimbs = data.filter(d => !d.isComp);
    const compClimbs = data.filter(d => d.isComp);

    const getMax = (list) => {
        if (!list.length) return "--";
        const best = list.reduce((prev, current) => {
            // On passe le flag isComp pour que le 15 compé soit comparé comme un 8 normal
            return (convertToNumeric(prev.grade, prev.system, prev.isComp) > 
                    convertToNumeric(current.grade, current.system, current.isComp)) ? prev : current;
        });
        return best.grade;
    };

    const bestNormal = getMax(normalClimbs);
    const bestComp = getMax(compClimbs);

    document.getElementById('best-normal').innerHTML = bestNormal !== "--" ? `⭐ ${bestNormal}` : "--";
    document.getElementById('best-comp').innerHTML = bestComp !== "--" ? `🔥 ${bestComp}` : "--";
}

function initCharts(data) {
    const ctxProg = document.getElementById('progressionChart');
    const ctxDiff = document.getElementById('difficultyChart');
    if (progressionChart) progressionChart.destroy();
    if (difficultyChart) difficultyChart.destroy();

    // 1. Préparation des labels (Dates)
    const labels = data.map(d => d.date.split('-').slice(1).reverse().join('/'));

    // 2. SÉPARATION DES DONNÉES pour la progression
    // On crée deux tableaux : si c'est pas le bon type, on met 'null' pour que Chart.js ne trace pas de point
    const normalScores = data.map(d => !d.isComp ? convertToNumeric(d.grade, d.system || "rosebloc", false) : null);
    const compScores = data.map(d => d.isComp ? convertToNumeric(d.grade, d.system || "rosebloc", true) : null);

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
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    spanGaps: true // Relie les points même s'il y a des sessions compé entre deux
                },
                {
                    label: 'Compétition',
                    data: compScores,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 3,
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
            plugins: { legend: { labels: { color: '#666', font: { weight: 'bold' } } } },
            scales: { y: { beginAtZero: false, min: 1, max: 16, ticks: { stepSize: 1 } } } 
        }
    });

    // 3. SÉPARATION DES DONNÉES pour la répartition (Barres)
    const countsNormal = Array(17).fill(0);
    const countsComp = Array(17).fill(0);
    
    data.forEach(d => {
        // On utilise true/false selon l'état du bloc
        const score = Math.min(convertToNumeric(d.grade, d.system || "rosebloc", d.isComp), 16);
        if (d.isComp) countsComp[score]++;
        else countsNormal[score]++;
    });

    difficultyChart = new Chart(ctxDiff, {
        type: 'bar',
        data: {
            labels: Array.from({length: 16}, (_, i) => i + 1),
            datasets: [
                { 
                    label: 'Normal', 
                    data: countsNormal.slice(1), 
                    backgroundColor: '#2ecc71',
                    borderRadius: 5
                },
                { 
                    label: 'Compétition', 
                    data: countsComp.slice(1), 
                    backgroundColor: '#e74c3c',
                    borderRadius: 5
                }
            ]
        },
        options: { 
            maintainAspectRatio: false,
            scales: { 
                x: { stacked: false }, // Les barres sont côte à côte pour mieux comparer
                y: { beginAtZero: true, ticks: { stepSize: 1 } } 
            }
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

function deleteClimb(id) {
    if (confirm("Supprimer ?")) db.ref(`users_climbs/${currentUser.uid}/${id}`).remove();
}

function updateCharts(range) {
    const days = { '1w': 7, '1m': 30, '6m': 180 };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days[range] || 9999));
    const filtered = range === 'all' ? allClimbs : allClimbs.filter(d => new Date(d.date) >= cutoff);
    
    document.querySelectorAll('.filter-buttons button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    initCharts(filtered);
}