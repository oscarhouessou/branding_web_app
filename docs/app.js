

class BrandingVerification {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.initCamera('plate');
        this.apiBaseUrl = 'https://branding-fastapi-194419091475.us-central1.run.app';
    }

    initializeElements() {
        // Select all necessary DOM elements
        this.elements = {
            plateVideo: document.getElementById('plateVideo'),
            logoVideo: document.getElementById('logoVideo'),
            platePreview: document.getElementById('platePreview'),
            logoPreview: document.getElementById('logoPreview'),
            submitButton: document.getElementById('submitButton'),
            retakeButton: document.getElementById('retakeButton'),
            plateStatus: document.getElementById('plateStatus'),
            logoStatus: document.getElementById('logoStatus'),
            plateResultImage: document.getElementById('plateResultImage'),
            logoResultImage: document.getElementById('logoResultImage'),
            plateNumberText: document.getElementById('plateNumberText'),
            plateVisibilityText: document.getElementById('plateVisibilityText'),
            logoVisibilityText: document.getElementById('logoVisibilityText'),
            summaryText: document.getElementById('summaryText'),
            processingPopup: document.getElementById('processingPopup'),
            instructionText: document.getElementById('instructionText'),
            plateCapture: document.getElementById('plateCapture'),
            logoCapture: document.getElementById('logoCapture'),
            startPlateCaptureBtn: document.getElementById('startPlateCaptureBtn'),
            startLogoCaptureBtn: document.getElementById('startLogoCaptureBtn'),
            retakePlateBtn: document.getElementById('retakePlateBtn'),
            retakeLogoBtn: document.getElementById('retakeLogoBtn'),
            formInputs: {
                firstName: document.getElementById('firstName'),
                lastName: document.getElementById('lastName'),
                phoneNumber: document.getElementById('phoneNumber')
            }
        };

        this.streams = {
            plate: null,
            logo: null
        };

        this.capturedImages = {
            plate: null,
            logo: null
        };

        this.requestId = null;
        this.processingResults = null;
    }

    bindEvents() {
        // Ensure submit button is enabled only when both inputs are captured
        this.elements.submitButton.disabled = true;

        this.elements.startPlateCaptureBtn.addEventListener('click', () => this.captureImage('plate'));
        this.elements.startLogoCaptureBtn.addEventListener('click', () => this.captureImage('logo'));
        this.elements.retakePlateBtn.addEventListener('click', () => this.resetCapture('plate'));
        this.elements.retakeLogoBtn.addEventListener('click', () => this.resetCapture('logo'));
        this.elements.retakeButton.addEventListener('click', () => this.resetEntireProcess());
        this.elements.submitButton.addEventListener('click', () => this.submitData());

        // Add validation to form inputs
        Object.values(this.elements.formInputs).forEach(input => {
            input.addEventListener('input', () => this.validateForm());
        });

        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button));
        });
    }

    validateForm() {
        const allFieldsFilled = Object.values(this.elements.formInputs).every(input => input.value.trim() !== '');
        const plateAndLogoCaptured = 
            this.elements.platePreview.classList.contains('captured') && 
            this.elements.logoPreview.classList.contains('captured');
        
        this.elements.submitButton.disabled = !(allFieldsFilled && plateAndLogoCaptured);
    }

    async initCamera(type) {
        const constraints = type === 'plate' 
            ? { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } }
            : { video: true };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.streams[type] = stream;

            if (type === 'plate') {
                this.elements.plateVideo.srcObject = stream;
                this.elements.plateCapture.classList.remove('hidden');
                this.elements.logoCapture.classList.add('hidden');
                this.elements.instructionText.textContent = 'Capturer la plaque d\'immatriculation du véhicule';
            } else {
                this.elements.logoVideo.srcObject = stream;
                this.elements.plateCapture.classList.add('hidden');
                this.elements.logoCapture.classList.remove('hidden');
                this.elements.instructionText.textContent = 'Capturer le logo du véhicule';
            }
        } catch (err) {
            console.error("Camera access error:", err);
            alert('Impossible d\'accéder à la caméra. Vérifiez vos autorisations.');
        }
    }

    stopCamera(stream) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }

    captureImage(type) {
        const videoElement = type === 'plate' ? this.elements.plateVideo : this.elements.logoVideo;
        const preview = type === 'plate' ? this.elements.platePreview : this.elements.logoPreview;
        const status = type === 'plate' ? this.elements.plateStatus : this.elements.logoStatus;
        const startBtn = type === 'plate' ? this.elements.startPlateCaptureBtn : this.elements.startLogoCaptureBtn;
        const retakeBtn = type === 'plate' ? this.elements.retakePlateBtn : this.elements.retakeLogoBtn;

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob(blob => {
            this.capturedImages[type] = blob;
        }, 'image/png');

        const imageUrl = canvas.toDataURL('image/png');

        status.innerHTML = `<i class="fas fa-check-circle"></i> ${type === 'plate' ? 'Plaque' : 'Logo'} capturé`;
        preview.style.backgroundImage = `url(${imageUrl})`;
        preview.classList.add('captured');

        this.stopCamera(this.streams[type]);
        startBtn.classList.add('hidden');
        retakeBtn.classList.remove('hidden');

        // Validate form after capturing
        this.validateForm();

        if (type === 'plate') {
            setTimeout(() => this.initCamera('logo'), 500);
        }
    }

    resetCapture(type) {
        const preview = type === 'plate' ? this.elements.platePreview : this.elements.logoPreview;
        const status = type === 'plate' ? this.elements.plateStatus : this.elements.logoStatus;
        const startBtn = type === 'plate' ? this.elements.startPlateCaptureBtn : this.elements.startLogoCaptureBtn;
        const retakeBtn = type === 'plate' ? this.elements.retakePlateBtn : this.elements.retakeLogoBtn;

        preview.style.backgroundImage = '';
        preview.classList.remove('captured');
        status.innerHTML = `<i class="fas fa-${type === 'plate' ? 'car' : 'image'}"></i>`;
        retakeBtn.classList.add('hidden');
        startBtn.classList.remove('hidden');

        // Reset captured image and result image
        this.capturedImages[type] = null;
        
        // Reset result images and text to placeholders
        this.elements.plateResultImage.src = 'assets/placeholder.svg';
        this.elements.logoResultImage.src = 'assets/placeholder.svg';
        this.elements.plateNumberText.textContent = 'Non détecté';
        this.elements.plateVisibilityText.textContent = 'N/A';
        this.elements.logoVisibilityText.textContent = 'N/A';

        this.initCamera(type);

        // Validate form after reset
        this.validateForm();
    }

    resetEntireProcess() {
        this.resetCapture('plate');
        this.resetCapture('logo');

        // Reset form inputs
        Object.values(this.elements.formInputs).forEach(input => input.value = '');

        // Reset request ID and processing results
        this.requestId = null;
        this.processingResults = null;

        // Clear summary
        this.elements.summaryText.innerHTML = '';

        // Validate form
        this.validateForm();
    }

    async submitData() {
        // Only submit if form is valid and both images are captured
        if (!this.elements.submitButton.disabled) {
            this.elements.processingPopup.classList.remove('hidden');

            try {
                // Prepare form data to send both images
                const formData = new FormData();
                formData.append('plate_image', this.capturedImages.plate, 'plate.png');
                formData.append('logo_image', this.capturedImages.logo, 'logo.png');

                // Send images to API
                const response = await fetch(`${this.apiBaseUrl}/detect`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                // Update UI with results
                if (result.plate || result.logo) {
                    // Store request ID and results
                    this.requestId = result.request_id;
                    this.processingResults = result;

                    // Update result images using Google Cloud Storage URL
                    this.elements.plateResultImage.src = this.convertGoogleStorageUrl(result.plate.plate_image_path);
                    this.elements.logoResultImage.src = this.convertGoogleStorageUrl(result.logo.logo_image_path);

                    // Update plate details
                    this.elements.plateNumberText.textContent = result.plate.text || 'Non détecté';
                    this.elements.plateVisibilityText.textContent = 
                        result.plate.ocr_confidence ? 
                        `Confiance OCR: ${(result.plate.score * 100).toFixed(2)}%` : 
                        'N/A';
                    
                    // Update logo details
                    this.elements.logoVisibilityText.textContent = 
                        result.logo.visibility || 
                        (result.logo.score ? `Score: ${(result.logo.score * 100).toFixed(2)}%` : 'N/A');

                    // Prepare summary details with user information and enhanced styling
                    const summaryInfo = `
                        <div class="result-summary-container">
                            <div class="result-summary-section user-details">
                                <div class="summary-section-header">
                                    <i class="fas fa-user"></i>
                                    <h3>Informations Personnelles</h3>
                                </div>
                                <div class="summary-section-content">
                                    <div class="detail-item">
                                        <span class="detail-label">Prénom</span>
                                        <span class="detail-value">${this.elements.formInputs.firstName.value}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Nom de famille</span>
                                        <span class="detail-value">${this.elements.formInputs.lastName.value}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Numéro de téléphone</span>
                                        <span class="detail-value">${this.elements.formInputs.phoneNumber.value}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="result-summary-section plate-details">
                                <div class="summary-section-header">
                                    <i class="fas fa-car"></i>
                                    <h3>Détails de la Plaque</h3>
                                </div>
                                <div class="summary-section-content">
                                    <div class="detail-item">
                                        <span class="detail-label">Numéro de plaque</span>
                                        <span class="detail-value">${result.plate.text || 'Non détecté'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Précision</span>
                                        <span class="detail-value">
                                            ${result.plate.ocr_confidence ? 
                                                `${(result.plate.score * 100).toFixed(2)}%` : 
                                                'Non évaluée'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="result-summary-section logo-details">
                                <div class="summary-section-header">
                                    <i class="fas fa-image"></i>
                                    <h3>Analyse du Logo</h3>
                                </div>
                                <div class="summary-section-content">
                                    <div class="detail-item">
                                        <span class="detail-label">Visibilité</span>
                                        <span class="detail-value">${result.logo.visibility || 'Non spécifiée'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-label">Score de détection</span>
                                        <span class="detail-value">
                                            ${result.logo.score ? 
                                                `${(result.logo.score * 100).toFixed(2)}%` : 
                                                'Non évalué'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="result-summary-section request-details">
                                <div class="summary-section-header">
                                    <i class="fas fa-info-circle"></i>
                                    <h3>Informations de la requête</h3>
                                </div>
                                <div class="summary-section-content">
                                    <div class="detail-item">
                                        <span class="detail-label">ID de requête</span>
                                        <span class="detail-value">${result.request_id}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    this.elements.summaryText.innerHTML = summaryInfo;

                    // Switch to Results tab
                    document.querySelector('.tab-button[data-tab="tab2"]').click();
                } else {
                    alert('Aucune information détectée');
                }
            } catch (error) {
                console.error('Erreur lors de la soumission:', error);
                alert('Impossible de soumettre les images. Vérifiez votre connexion.');
            } finally {
                this.elements.processingPopup.classList.add('hidden');
            }
        }
    }

    // Utility method to convert Google Storage URL to a displayable URL
    convertGoogleStorageUrl(gsUrl) {
        if (!gsUrl || !gsUrl.startsWith('gs://')) {
            return 'assets/placeholder.svg';
        }

        const bucket = gsUrl.split('/')[2];
        const path = gsUrl.split(bucket + '/')[1];
        return `https://storage.googleapis.com/${bucket}/${path}`;
    }

    switchTab(button) {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BrandingVerification();
});


