const firebaseURL = "https://climbingtracker-d0c24-default-rtdb.firebaseio.com/climbs.json";
let allClimbs = [];
let progressionChart, difficultyChart;

Chart.defaults.font.size = 10;

// 1. COMPRESSION IMAGE
const processImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

// 2. RÉCUPÉRATION ET CALCUL RECORDS
async function fetchClimbs() {
    try {
        const response = await fetch(firebaseURL);
        const data = await response.json();
        allClimbs = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        
        allClimbs.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        updateRecords(allClimbs);
        displayClimbs(allClimbs);
        initCharts(allClimbs);
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

function updateRecords(data) {
    const normalClimbs = data.filter(d => !d.isComp).map(d => d.grade);
    const compClimbs = data.filter(d => d.isComp).map(d => d.grade);

    const maxNormal = normalClimbs.length > 0 ? Math.max(...normalClimbs) : "--";
    const maxComp = compClimbs.length > 0 ? Math.max(...compClimbs) : "--";

    document.getElementById('best-normal').innerText = maxNormal !== "--" ? `Niv. ${maxNormal}` : "--";
    document.getElementById('best-comp').innerText = maxComp !== "--" ? `Niv. ${maxComp}` : "--";
}

// 3. GRAPHIQUES SÉPARÉS
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
                {
                    label: 'Non-Compétition',
                    data: normalLineData,
                    borderColor: '#27ae60',
                    borderWidth: 3,
                    pointRadius: 4,
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: 'Compétition',
                    data: compLineData,
                    borderColor: '#e74c3c',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointStyle: 'rectRot',
                    tension: 0.3,
                    spanGaps: true
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { min: 1, max: 16, ticks: { stepSize: 1 } } }
        }
    });

    const normalGradesCount = Array(17).fill(0);
    const compGradesCount = Array(17).fill(0);
    data.forEach(d => {
        if (d.grade) {
            if (d.isComp) compGradesCount[d.grade]++;
            else normalGradesCount[d.grade]++;
        }
    });

    difficultyChart = new Chart(ctxDiff, {
        type: 'bar',
        data: {
            labels: Array.from({length: 16}, (_, i) => i + 1),
            datasets: [
                {
                    label: 'Non-Compétition',
                    data: normalGradesCount.slice(1),
                    backgroundColor: '#2ecc71',
                    borderRadius: 4
                },
                {
                    label: 'Compétition',
                    data: compGradesCount.slice(1),
                    backgroundColor: '#e74c3c',
                    borderRadius: 4
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// 4. FILTRES ET ENVOI
function updateCharts(range) {
    const now = new Date();
    let filtered = [...allClimbs];
    if (range !== 'all') {
        const days = { '1w': 7, '1m': 30, '6m': 180 };
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - days[range]);
        filtered = allClimbs.filter(d => new Date(d.date) >= cutoff);
    }
    initCharts(filtered);
}

document.getElementById('climbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
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

    await fetch(firebaseURL, { method: 'POST', body: JSON.stringify(newClimb) });
    e.target.reset();
    btn.disabled = false;
    btn.innerText = "Enregistrer";
    fetchClimbs();
});

// 5. AFFICHAGE ET SUPPRESSION
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
                <button onclick="deleteClimb('${climb.id}')" style="background:#ff4757; color:white; border:none; padding:5px 10px; border-radius:8px; font-size:12px;">Supprimer</button>
            </div>
            ${climb.photo ? `<img src="${climb.photo}" style="width:100%; border-radius:12px; margin-top:10px;">` : ''}
        `;
        list.appendChild(div);
    });
}

async function deleteClimb(id) {
    if (confirm("Supprimer?")) {
        await fetch(`https://climbingtracker-d0c24-default-rtdb.firebaseio.com/climbs/${id}.json`, { method: 'DELETE' });
        fetchClimbs();
    }
}

fetchClimbs();