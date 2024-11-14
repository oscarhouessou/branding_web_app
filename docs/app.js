// Global variables
let mediaRecorder;
let recordedChunks = [];
let timerInterval;
let recordedVideoURL;
let stream;
const API_BASE_URL = 'https://branding-fastapi-app-194419091475.us-central1.run.app';

// DOM Elements
const video = document.getElementById('video');
const preview = document.getElementById('preview');
const startButton = document.getElementById('startRecord');
const stopButton = document.getElementById('stopRecord');
const retakeButton = document.getElementById('retakeButton');
const previewContainer = document.getElementById('previewContainer');
const recordingContainer = document.getElementById('recordingContainer');
const statusElement = document.getElementById('status');
const timerElement = document.getElementById('timer');
const championIDInput = document.getElementById('championID');
const lastNameInput = document.getElementById('lastName');
const submitButton = document.getElementById('submitButton');
const processingPopup = document.getElementById('processingPopup');
const downloadButton = document.getElementById('downloadButton');

// Initialize camera access
async function initializeCamera() {
    try {
        // Déterminer le mode de la caméra en fonction de l'appareil
        let facingMode = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            ? 'environment' // Caméra arrière pour mobile
            : 'user'; // Caméra frontale pour desktop
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: facingMode
            },
            audio: false
        });
        
        video.srcObject = stream;
        await video.play();

        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleRecordingStop;

        startButton.disabled = false;
        updateStatus("Prêt à enregistrer", "success");
    } catch (error) {
        console.error("Erreur d'accès à la caméra :", error);
        updateStatus(`Erreur d'accès à la caméra: ${error.message}`, "error");
    }
}

function updateStatus(message, type = "info") {
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
}

function handleDataAvailable(event) {
    if (event.data.size > 0) {
        recordedChunks.push(event.data);
    }
}

async function handleRecordingStop() {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    recordedVideoURL = URL.createObjectURL(blob);
    
    preview.src = recordedVideoURL;
    preview.controls = true;
    
    previewContainer.classList.remove('hidden');
    recordingContainer.classList.add('hidden');
    
    retakeButton.disabled = false;
    submitButton.disabled = false;
    downloadButton.disabled = false;
    
    clearInterval(timerInterval);
    timerElement.textContent = "00:00";
    
    updateStatus("Enregistrement terminé. Vous pouvez visionner la vidéo.", "success");
}

function startRecording() {
    if (!validateInputs()) {
        updateStatus("Veuillez remplir tous les champs obligatoires", "error");
        return;
    }

    recordedChunks = [];
    
    preview.src = '';
    previewContainer.classList.add('hidden');
    recordingContainer.classList.remove('hidden');
    
    startButton.disabled = true;
    stopButton.disabled = false;
    retakeButton.disabled = true;
    submitButton.disabled = true;
    downloadButton.disabled = true;
    
    try {
        mediaRecorder.start();
        updateStatus("Enregistrement en cours...", "info");
        startTimer();
    } catch (error) {
        console.error("Erreur de démarrage de l'enregistrement:", error);
        updateStatus("Erreur lors du démarrage de l'enregistrement", "error");
        resetUI();
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stopButton.disabled = true;
        clearInterval(timerInterval);
    }
}

function retakeVideo() {
    if (recordedVideoURL) {
        URL.revokeObjectURL(recordedVideoURL);
    }
    
    previewContainer.classList.add('hidden');
    recordingContainer.classList.remove('hidden');
    startButton.disabled = false;
    stopButton.disabled = true;
    retakeButton.disabled = true;
    submitButton.disabled = true;
    downloadButton.disabled = true;
    
    recordedChunks = [];
    timerElement.textContent = "00:00";
    updateStatus("Prêt à enregistrer", "info");
    
    if (video.srcObject) {
        video.play();
    } else {
        initializeCamera();
    }
}

function downloadVideo() {
    if (recordedChunks.length === 0) {
        updateStatus("Aucune vidéo à télécharger", "error");
        return;
    }
    
    try {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gozem-branding-${championIDInput.value}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Erreur lors du téléchargement:", error);
        updateStatus("Erreur lors du téléchargement de la vidéo", "error");
    }
}

async function submitVideo() {
    if (!validateInputs()) {
        updateStatus("Veuillez remplir tous les champs obligatoires", "error");
        return;
    }

    if (recordedChunks.length === 0) {
        updateStatus("Aucune vidéo à envoyer", "error");
        return;
    }

    showProcessingPopup();
    
    try {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('file', blob, `gozem-branding-${championIDInput.value}.webm`);

        const response = await fetch(`${API_BASE_URL}/process_video/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log("Réponse API:", data); // Pour le débogage
        
        if (data.status === "success" && data.results) {
            const processedData = {
                status: "success",
                logoDetected: data.results.best_logo?.visibility === "OK",
                plateDetected: Boolean(data.results.best_plate?.text),
                plateText: data.results.best_plate?.text || '',
                plateConfidence: data.results.best_plate?.score || 0,
                logoScore: data.results.best_logo?.best_score || 0,
                logoImageUrl: data.results.best_logo?.logo_image_url ? 
                    `${API_BASE_URL}${data.results.best_logo.logo_image_url}` : '',
                plateImageUrl: data.results.best_plate?.plate_image_url ? 
                    `${API_BASE_URL}${data.results.best_plate.plate_image_url}` : ''
            };

            console.log("Images URLs:", {
                logo: processedData.logoImageUrl,
                plate: processedData.plateImageUrl
            }); // Pour le débogage

            localStorage.setItem('resultData', JSON.stringify(processedData));
            localStorage.setItem('userData', JSON.stringify({
                championID: championIDInput.value,
                lastName: lastNameInput.value
            }));

            displayResults();
            showTab('tab2');
            updateStatus("Vidéo traitée avec succès !", "success");
        } else {
            throw new Error(data.message || "Erreur de traitement");
        }
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        updateStatus(`Erreur lors du traitement de la vidéo: ${error.message}`, "error");
    } finally {
        hideProcessingPopup();
    }
}

function displayResults() {
    const resultData = JSON.parse(localStorage.getItem('resultData'));
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    if (resultData && userData) {
        const logoImage = document.getElementById('logoImage');
        const plateImage = document.getElementById('plateImage');
        
        // Ajouter des gestionnaires d'erreur pour les images
        logoImage.onerror = function() {
            console.error('Erreur de chargement de l\'image du logo:', this.src);
            this.src = 'assets/no-image.svg';
        };
        
        plateImage.onerror = function() {
            console.error('Erreur de chargement de l\'image de la plaque:', this.src);
            this.src = 'assets/no-image.svg';
        };
        
        // Log avant de définir les sources
        console.log("Setting image sources:", {
            logo: resultData.logoImageUrl || 'assets/no-image.svg',
            plate: resultData.plateImageUrl || 'assets/no-image.svg'
        });
        
        logoImage.src = resultData.logoImageUrl || 'assets/no-image.svg';
        plateImage.src = resultData.plateImageUrl || 'assets/no-image.svg';
        
        document.getElementById('summaryText').innerHTML = `
            <div class="summary-item">
                <span class="label">Champion ID:</span>
                <span class="value">${userData.championID}</span>
            </div>
            <div class="summary-item">
                <span class="label">Nom:</span>
                <span class="value">${userData.lastName}</span>
            </div>
            <div class="summary-item">
                <span class="label">Logo détecté:</span>
                <span class="value ${resultData.logoDetected ? 'success' : 'failure'}">
                    ${resultData.logoDetected ? 'Oui' : 'Non'}
                </span>
            </div>
            <div class="summary-item">
                <span class="label">Score du logo:</span>
                <span class="value">${(resultData.logoScore * 100).toFixed(1)}%</span>
            </div>
            <div class="summary-item">
                <span class="label">Plaque détectée:</span>
                <span class="value ${resultData.plateDetected ? 'success' : 'failure'}">
                    ${resultData.plateDetected ? 'Oui' : 'Non'}
                </span>
            </div>
            ${resultData.plateDetected ? `
                <div class="summary-item">
                    <span class="label">Texte de la plaque:</span>
                    <span class="value">${resultData.plateText}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Confiance plaque:</span>
                    <span class="value">${(resultData.plateConfidence * 100).toFixed(1)}%</span>
                </div>
            ` : ''}
        `;
    }
}

function validateInputs() {
    return championIDInput.value.trim() && lastNameInput.value.trim();
}

function startTimer() {
    let seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerElement.textContent = `${padTime(minutes)}:${padTime(secs)}`;
    }, 1000);
}

function padTime(time) {
    return time < 10 ? `0${time}` : time;
}

function resetUI() {
    startButton.disabled = false;
    stopButton.disabled = true;
    retakeButton.disabled = true;
    submitButton.disabled = true;
    downloadButton.disabled = true;
}

function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-button');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    if (tabId === 'tab2') {
        displayResults();
    }
}

function showProcessingPopup() {
    processingPopup.classList.remove('hidden');
}

function hideProcessingPopup() {
    processingPopup.classList.add('hidden');
}

// Event Listeners
startButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording);
retakeButton.addEventListener('click', retakeVideo);
downloadButton.addEventListener('click', downloadVideo);
submitButton.addEventListener('click', submitVideo);

// Tab navigation
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        showTab(button.dataset.tab);
    });
});

// Initialize the application
initializeCamera();