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

// Configuration des échelles pour affichage
const SYSTEM_CONFIG = {
    rosebloc: { max: 25, labels: Array.from({length: 25}, (_, i) => i + 1) },
    vscale: { max: 18, labels: Array.from({length: 19}, (_, i) => "V" + i) },
    french: { 
        max: 18, 
        labels: ["4", "5", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "9a"] 
    }
};

// --- LOGIQUE DE CONVERSION ---

function getUniversalScore(grade, system) {
    let g = grade.toString().trim();
    if (system === "rosebloc") return parseInt(g) || 1;
    if (system === "vscale") {
        let vNum = parseInt(g.replace("V", "")) || 0;
        return (vNum === 0) ? 1 : vNum + 2; 
    }
    if (system === "french") {
        const idx = SYSTEM_CONFIG.french.labels.findIndex(l => g.toLowerCase().startsWith(l.toLowerCase()));
        return idx !== -1 ? idx + 1 : 1;
    }
    return parseInt(g) || 1;
}

function convertForDisplay(score, targetSystem) {
    if (targetSystem === "vscale") return score <= 1 ? 0 : score - 2;
    if (targetSystem === "french") return Math.max(0, score - 1);
    return score;
}

// --- AUTH & DATA ---

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        fetchClimbs();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

document.getElementById('loginBtn').onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
document.getElementById('logoutBtn').onclick = () => auth.signOut();

function updateGradeInput() {
    const sys = document.getElementById('gradeSystem').value;
    const gInput = document.getElementById('grade');
    gInput.type = (sys === "rosebloc") ? "number" : "text";
    gInput.placeholder = (sys === "rosebloc") ? "1-25" : (sys === "vscale" ? "V5" : "7a");
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
    const getBest = (list) => {
        if (!list.length) return "--";
        return list.reduce((prev, curr) => 
            getUniversalScore(prev.grade, prev.system) > getUniversalScore(curr.grade, curr.system) ? prev : curr
        ).grade;
    };
    document.getElementById('best-normal').innerText = getBest(data.filter(d => !d.isComp));
    document.getElementById('best-comp').innerText = getBest(data.filter(d => d.isComp));
}

// --- GRAPHIQUES ---

function initCharts(data) {
    const displaySys = document.getElementById('displaySystem').value;
    const config = SYSTEM_CONFIG[displaySys];
    const ctxProg = document.getElementById('progressionChart');
    const ctxDiff = document.getElementById('difficultyChart');

    if (progressionChart) progressionChart.destroy();
    if (difficultyChart) difficultyChart.destroy();

    const labels = data.map(d => d.date.split('-').slice(1).reverse().join('/'));

    const series = (isComp) => data.map(d => {
        if (d.isComp !== isComp) return null;
        return convertForDisplay(getUniversalScore(d.grade, d.system), displaySys);
    });

    progressionChart = new Chart(ctxProg, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Normal', data: series(false), borderColor: '#2ecc71', spanGaps: true, tension: 0.3 },
                { label: 'Compé', data: series(true), borderColor: '#e74c3c', spanGaps: true, tension: 0.3 }
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: { 
                    min: 0, 
                    max: config.max, 
                    ticks: { callback: (val) => config.labels[val] || val } 
                }
            }
        }
    });

    const countsNormal = Array(config.max + 1).fill(0);
    const countsComp = Array(config.max + 1).fill(0);
    data.forEach(d => {
        const score = Math.min(convertForDisplay(getUniversalScore(d.grade, d.system), displaySys), config.max);
        if (d.isComp) countsComp[score]++; else countsNormal[score]++;
    });

    difficultyChart = new Chart(ctxDiff, {
        type: 'bar',
        data: {
            labels: config.labels,
            datasets: [
                { label: 'Normal', data: countsNormal, backgroundColor: '#2ecc71' },
                { label: 'Compé', data: countsComp, backgroundColor: '#e74c3c' }
            ]
        },
        options: { maintainAspectRatio: false }
    });
}

// --- FORMULAIRE ET ENREGISTREMENT ---

document.getElementById('climbForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;

    const newClimb = {
        location: document.getElementById('location').value,
        system: document.getElementById('gradeSystem').value,
        grade: document.getElementById('grade').value,
        date: document.getElementById('date').value,
        color: document.getElementById('color').value,
        tries: parseInt(document.getElementById('tries').value),
        isComp: document.getElementById('isComp').checked
    };

    await db.ref(`users_climbs/${currentUser.uid}`).push(newClimb);
    e.target.reset();
    btn.disabled = false;
};

function displayClimbs(data) {
    const list = document.getElementById('climbList');
    list.innerHTML = "";
    const colorMap = { 
        "Jaune": "#FFD700", "Orange": "#FF8C00", "Vert": "#2ecc71", 
        "Turquoise": "#40E0D0", "Bleu": "#3498db", "Rouge": "#e74c3c", 
        "Rose": "#ff9ff3", "Noir": "#2d3436", "Blanc": "#ffffff", "Mauve": "#9b59b6" 
    };

    [...data].reverse().forEach(climb => {
        const div = document.createElement('div');
        div.className = 'climb-item';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <small style="color:#888">${climb.date}</small><br>
                    <span class="color-dot" style="background:${colorMap[climb.color] || '#ccc'}"></span>
                    <b>${climb.grade}</b> <small>(${climb.tries} essais)</small>
                    ${climb.isComp ? '<span class="badge-comp">COMPÉ</span>' : ''}
                </div>
                <button onclick="deleteClimb('${climb.id}')" style="padding:5px 10px; background:#ff4757; font-size:10px; width:auto">Supprimer</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function deleteClimb(id) {
    if (confirm("Supprimer cette grimpe ?")) db.ref(`users_climbs/${currentUser.uid}/${id}`).remove();
}

function updateCharts(range) {
    const days = { '1w': 7, '1m': 30, '6m': 180 };
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days[range] || 9999));
    const filtered = range === 'all' ? allClimbs : allClimbs.filter(d => new Date(d.date) >= cutoff);
    initCharts(filtered);
}