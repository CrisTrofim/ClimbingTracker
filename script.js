const firebaseURL = "https://climbingtracker-d0c24-default-rtdb.firebaseio.com/climbs.json";
let allClimbs = [];
let progressionChart, difficultyChart;

// Configuration Chart.js globale pour Mobile
Chart.defaults.font.size = 10;
Chart.defaults.plugins.legend.display = false;

// --- 1. FONCTION DE COMPRESSION IMAGE ---
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
                // Compresse à 70% pour économiser l'espace Firebase
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

// --- 2. RÉCUPÉRATION DES DONNÉES ---
async function fetchClimbs() {
    try {
        const response = await fetch(firebaseURL);
        const data = await response.json();
        allClimbs = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        
        // Trier par date pour les graphiques
        allClimbs.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        displayClimbs(allClimbs);
        initCharts(allClimbs);
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

// --- 3. INITIALISATION DES GRAPHIQUES ---
function initCharts(data) {
    const ctxProg = document.getElementById('progressionChart').getContext('2d');
    const ctxDiff = document.getElementById('difficultyChart').getContext('2d');

    if (progressionChart) progressionChart.destroy();
    if (difficultyChart) difficultyChart.destroy();

    // Graphique Progression
    progressionChart = new Chart(ctxProg, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.split('-').slice(1).join('/')),
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
            scales: { y: { min: 1, max: 16, grid: { display: false }, ticks: { stepSize: 1 } } }
        }
    });

    // Graphique Répartition
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

// --- 4. FILTRES TEMPORELS ---
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

// --- 5. ENVOI DU FORMULAIRE ---
document.getElementById('climbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "⏳...";

    const fileInput = document.getElementById('photo');
    let imageData = "";

    // Correction : on utilise la fonction processImage ici
    if (fileInput.files && fileInput.files[0]) {
        imageData = await processImage(fileInput.files[0]);
    }

    const newClimb = {
        date: document.getElementById('date').value,
        grade: parseInt(document.getElementById('grade').value),
        tries: parseInt(document.getElementById('tries').value),
        photo: imageData
    };

    try {
        await fetch(firebaseURL, { method: 'POST', body: JSON.stringify(newClimb) });
        e.target.reset();
        await fetchClimbs();
    } catch (error) {
        alert("Erreur de sauvegarde");
    } finally {
        btn.disabled = false;
        btn.innerText = "Enregistrer";
    }
});

// --- 6. SUPPRESSION ET AFFICHAGE ---
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
                <button onclick="deleteClimb('${climb.id}')" style="background:#ff4757; color:white; border:none; padding:5px 10px; font-size:12px; border-radius:6px;">Supprimer</button>
            </div>
            ${climb.photo ? `<img src="${climb.photo}" style="width:100%; border-radius:12px; margin-top:10px;">` : ''}
        `;
        list.appendChild(div);
    });
}

fetchClimbs();