let mediaRecorder;
let recordedChunks = [];
let timerInterval;
let recordedVideoURL;
let stream;

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
// Modification pour permettre l'utilisation de la caméra arrière par défaut sur mobile
async function initializeCamera() {
    try {
        let facingMode = 'user'; // Caméra frontale par défaut
        
        // Vérifier si c'est un appareil mobile
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            facingMode = 'environment'; // Utiliser la caméra arrière sur les appareils mobiles
        }
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: facingMode
            },
            audio: true 
        });
        
        video.srcObject = stream;
        video.play();

        // Initialiser MediaRecorder avec de meilleures options
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });

        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleRecordingStop;

        startButton.disabled = false;
        statusElement.textContent = "Prêt à enregistrer";
    } catch (error) {
        console.error("Erreur d'accès à la caméra :", error);
        statusElement.textContent = "Erreur d'accès à la caméra : " + error.message;
    }
}

// Handle recording data
function handleDataAvailable(event) {
    if (event.data.size > 0) {
        recordedChunks.push(event.data);
    }
}

// Handle recording stop
async function handleRecordingStop() {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    recordedVideoURL = URL.createObjectURL(blob);
    
    // Convertir la vidéo WebM en MP4
    const mp4Blob = await convertToMP4(blob);
    const mp4URL = URL.createObjectURL(mp4Blob);
    
    // Configure preview video
    preview.src = mp4URL;
    preview.controls = true;
    
    // Show/hide containers
    previewContainer.classList.remove('hidden');
    recordingContainer.classList.add('hidden');
    
    // Enable relevant buttons
    retakeButton.disabled = false;
    submitButton.disabled = false;
    downloadButton.disabled = false;
    
    clearInterval(timerInterval);
    timerElement.textContent = "00:00";
    
    statusElement.textContent = "Enregistrement terminé. Vous pouvez visionner la vidéo.";
}

// Convert WebM to MP4
async function convertToMP4(webmBlob) {
    try {
        const ffmpeg = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
        await ffmpeg.load();

        ffmpeg.FS('writeFile', 'input.webm', await webmBlob.arrayBuffer());
        await ffmpeg.run('-i', 'input.webm', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', 'output.mp4');
        const mp4Data = ffmpeg.FS('readFile', 'output.mp4');
        return new Blob([mp4Data.buffer], { type: 'video/mp4' });
    } catch (error) {
        console.error("Erreur de conversion en MP4:", error);
        throw error;
    }
}

// Start recording
function startRecording() {
    recordedChunks = [];
    
    // Reset UI
    preview.src = '';
    previewContainer.classList.add('hidden');
    recordingContainer.classList.remove('hidden');
    
    // Configure buttons
    startButton.disabled = true;
    stopButton.disabled = false;
    retakeButton.disabled = true;
    submitButton.disabled = true;
    downloadButton.disabled = true;
    
    // Start recording
    try {
        mediaRecorder.start();
        statusElement.textContent = "Enregistrement en cours...";
        startTimer();
    } catch (error) {
        console.error("Erreur de démarrage de l'enregistrement:", error);
        statusElement.textContent = "Erreur lors du démarrage de l'enregistrement";
        resetUI();
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stopButton.disabled = true;
        
        // Arrêter le timer
        clearInterval(timerInterval);
    }
}

// Retake video
function retakeVideo() {
    // Clean up previous recording
    if (recordedVideoURL) {
        URL.revokeObjectURL(recordedVideoURL);
    }
    
    // Reset UI
    previewContainer.classList.add('hidden');
    recordingContainer.classList.remove('hidden');
    startButton.disabled = false;
    stopButton.disabled = true;
    retakeButton.disabled = true;
    submitButton.disabled = true;
    downloadButton.disabled = true;
    
    recordedChunks = [];
    timerElement.textContent = "00:00";
    statusElement.textContent = "Prêt à enregistrer";
    
    // Ensure video stream is active
    if (video.srcObject) {
        video.play();
    } else {
        initializeCamera();
    }
}

// Download recorded video
function downloadVideo() {
    if (recordedChunks.length === 0) {
        statusElement.textContent = "Aucune vidéo à télécharger";
        return;
    }
    
    try {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Erreur lors du téléchargement:", error);
        statusElement.textContent = "Erreur lors du téléchargement de la vidéo";
    }
}

// Upload video to API
async function submitVideo() {
    if (recordedChunks.length === 0) {
        statusElement.textContent = "Aucune vidéo à envoyer";
        return;
    }

    if (!championIDInput.value || !lastNameInput.value) {
        statusElement.textContent = "Veuillez remplir tous les champs";
        return;
    }

    showProcessingPopup();
    
    try {
        // Convertir WebM en MP4 (effectué dans handleRecordingStop)
        const blob = new Blob(recordedChunks, { type: 'video/mp4' });
        const formData = new FormData();
        formData.append('file', blob, 'video.mp4');
        formData.append('championID', championIDInput.value);
        formData.append('lastName', lastNameInput.value);

        const response = await fetch('https://branding-fastapi-app-194419091475.us-central1.run.app/process_video/', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.status === "success") {
            localStorage.setItem('resultData', JSON.stringify(data));
            localStorage.setItem('userData', JSON.stringify({
                championID: championIDInput.value,
                lastName: lastNameInput.value
            }));
            showTab('tab2');
            statusElement.textContent = "Vidéo traitée avec succès !";
        } else {
            throw new Error(data.message || "Erreur de traitement");
        }
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        statusElement.textContent = "Erreur lors du traitement de la vidéo: " + error.message;
    } finally {
        hideProcessingPopup();
    }
}

// Timer functions
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

// Reset UI state
function resetUI() {
    startButton.disabled = false;
    stopButton.disabled = true;
    retakeButton.disabled = true;
    submitButton.disabled = true;
    downloadButton.disabled = true;
}

// Tab management
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

// Display results
function displayResults() {
    const resultData = JSON.parse(localStorage.getItem('resultData'));
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    if (resultData && userData) {
        const logoImage = document.getElementById('logoImage');
        const plateImage = document.getElementById('plateImage');
        
        logoImage.src = resultData.logoDetected || 'assets/no-image.svg';
        plateImage.src = resultData.plateDetected || 'assets/no-image.svg';
        
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
                <span class="label">Plaque détectée:</span>
                <span class="value ${resultData.plateDetected ? 'success' : 'failure'}">
                    ${resultData.plateDetected ? 'Oui' : 'Non'}
                </span>
            </div>
        `;
    }
}

// Popup management
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


// redeploieement 
// Initialize the application
initializeCamera();