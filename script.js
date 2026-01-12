// CONFIGURATION FIREBASE (REMPLACE PAR TES INFOS)
const firebaseConfig = {
  apiKey: "AIzaSyAhPqDCcq42FzYnkyGvzJTFX1U3cYqHYE8",
  authDomain: "climbingtracker-d0c24.firebaseapp.com",
  databaseURL: "https://climbingtracker-d0c24-default-rtdb.firebaseio.com",
  projectId: "climbingtracker-d0c24",
  storageBucket: "climbingtracker-d0c24.firebasestorage.app",
  messagingSenderId: "490789229720",
  appId: "1:490789229720:web:9a97027005173d05066ced"
};

// Initialisation
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let allClimbs = [];
let progressionChart, difficultyChart;

Chart.defaults.font.size = 10;

// --- A. AUTHENTIFICATION ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        fetchClimbs();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

document.getElementById('loginBtn').onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert(err.message));
};

document.getElementById('logoutBtn').onclick = () => auth.signOut();

// --- B. GESTION DES DONNÉES ---
async function fetchClimbs() {
    if (!currentUser) return;
    // On récupère uniquement les données de l'utilisateur connecté (ID unique)
    const ref = db.ref(`users_climbs/${currentUser.uid}`);
    ref.on('value', snapshot => {
        const data = snapshot.val();
        allClimbs = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        allClimbs.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        updateRecords(allClimbs);
        displayClimbs(allClimbs);
        initCharts(allClimbs);
    });
}

function updateRecords(data) {
    const normalClimbs = data.filter(d => !d.isComp).map(d => d.grade);
    const compClimbs = data.filter(d => d.isComp).map(d => d.grade);
    const maxNormal = normalClimbs.length > 0 ? Math.max(...normalClimbs) : "--";
    const maxComp = compClimbs.length > 0 ? Math.max(...compClimbs) : "--";
    document.getElementById('best-normal').innerText = maxNormal !== "--" ? `Niv. ${maxNormal}` : "--";
    document.getElementById('best-comp').innerText = maxComp !== "--" ? `Niv. ${maxComp}` : "--";
}

// --- C. GRAPHIQUES ---
function initCharts(data) {
    const ctxProg = document.getElementById('progressionChart').getContext('2d');
    const ctxDiff = document.getElementById('difficultyChart').getContext('2d');
    if (progressionChart) progressionChart.destroy();
    if (difficultyChart) difficultyChart.destroy();

    const labels = data.map(d => d.date.split('-').slice(1).join('/'));
    const normalLineData = data.map(d => d.isComp ? null : d.grade);
    const compLineData = data.map(d => d.isComp ? d.grade : null);

    progressionChart = new Chart(ctxProg, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Non-Compétition', data: normalLineData, borderColor: '#27ae60', borderWidth: 3, pointRadius: 4, tension: 0.3, spanGaps: true },
                { label: 'Compétition', data: compLineData, borderColor: '#e74c3c', borderWidth: 3, pointRadius: 6, pointStyle: 'rectRot', tension: 0.3, spanGaps: true }
            ]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { min: 1, max: 16, ticks: { stepSize: 1 } } } }
    });

    const countsN = Array(17).fill(0);
    const countsC = Array(17).fill(0);
    data.forEach(d => {
        if (d.grade) {
            if (d.isComp) countsC[d.grade]++;
            else countsN[d.grade]++;
        }
    });

    difficultyChart = new Chart(ctxDiff, {
        type: 'bar',
        data: {
            labels: Array.from({length: 16}, (_, i) => i + 1),
            datasets: [
                { label: 'Non-Compétition', data: countsN.slice(1), backgroundColor: '#2ecc71', borderRadius: 4 },
                { label: 'Compétition', data: countsC.slice(1), backgroundColor: '#e74c3c', borderRadius: 4 }
            ]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// --- D. FORMULAIRE ET UTILS ---
const processImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

document.getElementById('climbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "⏳...";

    const fileInput = document.getElementById('photo');
    let imageData = fileInput.files[0] ? await processImage(fileInput.files[0]) : "";

    const newClimb = {
        date: document.getElementById('date').value,
        grade: parseInt(document.getElementById('grade').value),
        color: document.getElementById('color').value,
        tries: parseInt(document.getElementById('tries').value),
        isComp: document.getElementById('isComp').checked,
        photo: imageData
    };

    await db.ref(`users_climbs/${currentUser.uid}`).push(newClimb);
    e.target.reset();
    btn.disabled = false;
    btn.innerText = "Enregistrer";
});

function displayClimbs(data) {
    const list = document.getElementById('climbList');
    list.innerHTML = "";
    const colorMap = { "Jaune": "#FFD700", "Orange": "#FF8C00", "Vert": "#2ecc71", "Bleu": "#3498db", "Rouge": "#e74c3c", "Rose": "#ff9ff3", "Noir": "#2d3436", "Blanc": "#ffffff", "Mauve": "#9b59b6" };

    [...data].reverse().forEach(climb => {
        const div = document.createElement('div');
        div.className = `climb-item ${climb.isComp ? 'comp-session' : ''}`;
        const dotColor = colorMap[climb.color] || "#ccc";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:#888; font-size:11px;">${climb.date}</span>
                    ${climb.isComp ? '<span class="badge-comp">COMPÉ</span>' : ''}<br>
                    <span class="color-dot" style="background-color: ${dotColor}"></span>
                    <b>Niveau ${climb.grade}</b> <small>(${climb.tries} essais)</small>
                </div>
                <button onclick="deleteClimb('${climb.id}')" style="background:#ff4757; color:white; border:none; padding:5px 10px; border-radius:8px; font-size:12px; width:auto;">Supprimer</button>
            </div>
            ${climb.photo ? `<img src="${climb.photo}" style="width:100%; border-radius:12px; margin-top:10px;">` : ''}
        `;
        list.appendChild(div);
    });
}

function deleteClimb(id) {
    if (confirm("Supprimer?")) db.ref(`users_climbs/${currentUser.uid}/${id}`).remove();
}

function updateCharts(range) {
    const cutoff = new Date();
    const days = { '1w': 7, '1m': 30, '6m': 180 };
    cutoff.setDate(cutoff.getDate() - (days[range] || 9999));
    const filtered = range === 'all' ? allClimbs : allClimbs.filter(d => new Date(d.date) >= cutoff);
    initCharts(filtered);
}