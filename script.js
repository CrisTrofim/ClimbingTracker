const firebaseURL = "https://climbingtracker-d0c24-default-rtdb.firebaseio.com/climbs.json";
let allClimbs = [];
let progressionChart, difficultyChart;

// Configuration Chart.js globale pour Mobile
Chart.defaults.font.size = 10;
Chart.defaults.plugins.legend.display = false;

async function fetchClimbs() {
    try {
        const response = await fetch(firebaseURL);
        const data = await response.json();
        allClimbs = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        
        // Trier par date
        allClimbs.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        displayClimbs(allClimbs);
        initCharts(allClimbs);
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

function initCharts(data) {
    const ctxProg = document.getElementById('progressionChart').getContext('2d');
    const ctxDiff = document.getElementById('difficultyChart').getContext('2d');

    if (progressionChart) progressionChart.destroy();
    if (difficultyChart) difficultyChart.destroy();

    // 1. Graphique Progression
    progressionChart = new Chart(ctxProg, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.split('-').slice(1).join('/')), // Format MM/DD
            datasets: [{
                data: data.map(d => d.grade),
                borderColor: '#27ae60',
                borderWidth: 3,
                pointRadius: 4,
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(39, 174, 96, 0.1)'
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { min: 1, max: 16, grid: { display: false } } }
        }
    });

    // 2. Graphique Répartition (Volumes par grade)
    const gradesCount = Array(17).fill(0);
    data.forEach(d => { if(d.grade) gradesCount[d.grade]++ });

    difficultyChart = new Chart(ctxDiff, {
        type: 'bar',
        data: {
            labels: Array.from({length: 16}, (_, i) => i + 1),
            datasets: [{
                data: gradesCount.slice(1),
                backgroundColor: '#3498db',
                borderRadius: 5
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function updateCharts(range) {
    const now = new Date();
    let filtered = [...allClimbs];

    if (range !== 'all') {
        const days = { '1w': 7, '1m': 30, '6m': 180 };
        const cutoff = new Date().setDate(now.getDate() - days[range]);
        filtered = allClimbs.filter(d => new Date(d.date) >= cutoff);
    }
    initCharts(filtered);
}

// ... (Garder processImage du message précédent) ...

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
        tries: parseInt(document.getElementById('tries').value),
        photo: imageData
    };

    await fetch(firebaseURL, { method: 'POST', body: JSON.stringify(newClimb) });
    e.target.reset();
    btn.disabled = false;
    btn.innerText = "Enregistrer";
    fetchClimbs();
});

async function deleteClimb(id) {
    if (confirm("Supprimer?")) {
        await fetch(`https://climbingtracker-d0c24-default-rtdb.firebaseio.com/climbs/${id}.json`, { method: 'DELETE' });
        fetchClimbs();
    }
}

function displayClimbs(data) {
    const list = document.getElementById('climbList');
    list.innerHTML = "";
    [...data].reverse().forEach(climb => {
        const div = document.createElement('div');
        div.className = 'climb-item';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="color:#888; font-size:12px;">${climb.date}</span><br>
                    <b>Niveau ${climb.grade}</b> <small>(${climb.tries} essais)</small>
                </div>
                <button onclick="deleteClimb('${climb.id}')" style="background:#ff4757; padding:5px 10px; font-size:12px;">Supprimer</button>
            </div>
            ${climb.photo ? `<img src="${climb.photo}">` : ''}
        `;
        list.appendChild(div);
    });
}

fetchClimbs();