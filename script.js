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
    vscale: { max: 20, labels: ["-", "-", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18"] },
    french: { max: 20, labels: ["-", "4", "5", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "9a", "9a+"] }
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let allClimbs = [];
let progressionChart;
let currentViewDate = new Date();
let isCalendarMode = false;

// --- INITIALISATION ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        updateGradeInput();
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
    const gSelect = document.getElementById('grade');
    const config = SYSTEM_CONFIG[sys];
    gSelect.innerHTML = "";
    config.labels.forEach(label => {
        if (label !== "-") {
            const opt = document.createElement('option');
            opt.value = label; opt.textContent = label;
            gSelect.appendChild(opt);
        }
    });
}

// --- DATA ---
function fetchClimbs() {
    db.ref(`users_climbs/${currentUser.uid}`).on('value', snap => {
        const data = snap.val();
        allClimbs = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        allClimbs.sort((a, b) => new Date(a.date) - new Date(b.date));
        refreshAllData();
    });
}

function refreshAllData() {
    updateRecords(allClimbs);
    initCharts(allClimbs);
    renderNavigation();
    displayClimbs(allClimbs);
}

// --- NAVIGATION (CAROUSEL & CALENDRIER) ---
function renderNavigation() {
    if (isCalendarMode) renderCalendar();
    else renderWeekCarousel();
}

function renderWeekCarousel() {
    const carousel = document.getElementById('week-carousel');
    carousel.innerHTML = "";
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));

    for (let i = 0; i < 7; i++) {
        const curr = new Date(start);
        curr.setDate(start.getDate() + i);
        const dStr = curr.toISOString().split('T')[0];
        const hasData = allClimbs.some(c => c.date === dStr);
        
        const div = document.createElement('div');
        div.className = `day-item ${curr.toDateString() === today.toDateString() ? 'active' : ''} ${hasData ? 'has-data' : ''}`;
        div.onclick = () => filterByDate(dStr);
        div.innerHTML = `<span class="day-name">${['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][curr.getDay()]}</span>
                         <span class="day-number">${curr.getDate()}</span>`;
        carousel.appendChild(div);
    }
}

function toggleCalendarView() {
    isCalendarMode = !isCalendarMode;
    document.getElementById('week-carousel').style.display = isCalendarMode ? 'none' : 'flex';
    document.getElementById('calendar-container').style.display = isCalendarMode ? 'block' : 'none';
    document.getElementById('nav-title').textContent = isCalendarMode ? "Calendrier" : "Cette semaine";
    document.getElementById('toggleViewBtn').textContent = isCalendarMode ? "⬅ Retour" : "📅 Calendrier";
    if (isCalendarMode) renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = "";
    const month = currentViewDate.getMonth();
    const year = currentViewDate.getFullYear();
    
    document.getElementById('current-month-display').textContent = 
        currentViewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${year}-${(month+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
        const climbs = allClimbs.filter(c => c.date === dStr);
        const dayDiv = document.createElement('div');
        dayDiv.className = `cal-day ${climbs.length ? 'has-climb' : ''}`;
        dayDiv.innerHTML = `<b>${d}</b>${climbs.length ? `<br><span style="font-size:8px">${climbs[0].grade}</span>` : ''}`;
        dayDiv.onclick = () => filterByDate(dStr);
        grid.appendChild(dayDiv);
    }
}

function changeMonth(dir) {
    currentViewDate.setMonth(currentViewDate.getMonth() + dir);
    renderCalendar();
}

function filterByDate(dateStr) {
    const filtered = allClimbs.filter(c => c.date === dateStr);
    displayClimbs(filtered);
    document.getElementById('resetFilterBtn').style.display = 'block';
    showToast(`Session du ${dateStr}`);
}

function resetFilter() {
    displayClimbs(allClimbs);
    document.getElementById('resetFilterBtn').style.display = 'none';
}

// --- CHART & RECORDS (Logique existante préservée) ---
function convertToNumeric(grade, system, isComp = false, target = "rosebloc") {
    let g = parseInt(grade) || 1;
    if (system === "rosebloc") {
        if (isComp && target !== "rosebloc") {
            const map = {1:1, 2:2, 3:3, 5:4, 7:5, 9:6, 12:7, 14:8, 16:9, 18:10, 20:12};
            return map[g] || g;
        }
        return g;
    }
    if (system === "vscale") return (parseInt(grade.toString().replace("V","")) || 0) + 2;
    if (system === "french") return Math.max(1, SYSTEM_CONFIG.french.labels.indexOf(grade));
    return g;
}

function initCharts(data) {
    const ctx = document.getElementById('progressionChart');
    const sys = document.getElementById('displaySystem').value;
    const config = SYSTEM_CONFIG[sys];

    if (progressionChart) progressionChart.destroy();
    
    progressionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.split('-').slice(1).reverse().join('/')),
            datasets: [{
                label: 'Niveau',
                data: data.map(d => convertToNumeric(d.grade, d.system, d.isComp, sys)),
                borderColor: '#2ecc71',
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(46, 204, 113, 0.1)'
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: {
                    max: config.max,
                    ticks: { callback: (val) => config.labels[val] || val }
                }
            }
        }
    });
}

function updateRecords(data) {
    const sys = document.getElementById('displaySystem').value;
    const findBest = (list) => {
        if (!list.length) return "--";
        const best = list.reduce((a, b) => convertToNumeric(a.grade, a.system) > convertToNumeric(b.grade, b.system) ? a : b);
        return SYSTEM_CONFIG[sys].labels[Math.round(convertToNumeric(best.grade, best.system, best.isComp, sys))] || best.grade;
    };
    document.getElementById('best-normal').textContent = findBest(data.filter(d => !d.isComp));
    document.getElementById('best-comp').textContent = findBest(data.filter(d => d.isComp));
}

// --- CRUD ---
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
        isComp: document.getElementById('isComp').checked,
        photo: "" 
    };

    await db.ref(`users_climbs/${currentUser.uid}`).push(newClimb);
    e.target.reset();
    btn.disabled = false;
    showToast("Grimpe ajoutée !");
};

function displayClimbs(data) {
    const list = document.getElementById('climbList');
    list.innerHTML = data.length ? "" : "Aucune grimpe trouvée.";
    const colorMap = { "Jaune": "#FFD700", "Orange": "#FF8C00", "Vert": "#2ecc71", "Turquoise": "#40E0D0", "Bleu": "#3498db", "Rouge": "#e74c3c", "Rose": "#ff9ff3", "Noir": "#2d3436", "Blanc": "#fff", "Mauve": "#9b59b6" };

    [...data].reverse().forEach(c => {
        const div = document.createElement('div');
        div.className = 'climb-item';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <small>${c.date} • ${c.location}</small><br>
                    <span class="color-dot" style="background:${colorMap[c.color] || '#ccc'}"></span>
                    <b>${c.grade}</b> <small>(${c.tries} essais)</small>
                </div>
                <button onclick="confirmDeleteClimb('${c.id}')" style="padding:4px 8px; background:#ff4757; font-size:10px;">X</button>
            </div>`;
        list.appendChild(div);
    });
}

let deleteId = null;
function confirmDeleteClimb(id) {
    deleteId = id;
    document.getElementById('custom-modal').style.display = 'flex';
}
document.getElementById('confirmDelete').onclick = () => {
    db.ref(`users_climbs/${currentUser.uid}/${deleteId}`).remove();
    document.getElementById('custom-modal').style.display = 'none';
    showToast("Supprimé");
};
document.getElementById('cancelDelete').onclick = () => document.getElementById('custom-modal').style.display = 'none';

function showToast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}