document.addEventListener('DOMContentLoaded', () => {
    // State
    let jobs = JSON.parse(localStorage.getItem('tiler_jobs')) || [];
    let currentJobId = null;

    // View Containers
    const homeView = document.getElementById('home-view');
    const creatorView = document.getElementById('creator-view');

    // Home Elements
    const jobsList = document.getElementById('jobs-list');
    const fabCreate = document.getElementById('fab-create');

    // Creator Elements
    const btnBack = document.getElementById('btn-back');
    const btnSave = document.getElementById('btn-save');
    const btnAddSection = document.getElementById('add-section-btn');
    const btnExportPdf = document.getElementById('export-pdf-btn');
    const sectionsContainer = document.getElementById('sections-container');
    const clientNameInput = document.getElementById('client-name');
    const jobDateEl = document.getElementById('job-date');
    const advancePaymentInput = document.getElementById('advance-payment');
    
    // PWA Install Logic
    const installAppBtn = document.getElementById('install-app-btn');
    let deferredPrompt;

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registered', reg))
                .catch(err => console.error('Service Worker registration failed', err));
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI to notify the user they can add to home screen
        if(installAppBtn) installAppBtn.style.display = 'flex';
    });

    if(installAppBtn) {
        installAppBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                    installAppBtn.style.display = 'none';
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
            }
        });
    }
    const grandTotalEl = document.getElementById('grand-total');
    const finalBalanceEl = document.getElementById('final-balance');

    // Templates
    const sectionTemplate = document.getElementById('section-template');
    const itemTemplate = document.getElementById('item-template');

    // Initialization
    renderJobsList();

    // --- Navigation & Events ---

    fabCreate.addEventListener('click', () => {
        createNewJob();
        switchView('creator');
    });

    btnBack.addEventListener('click', () => {
        switchView('home');
    });

    btnSave.addEventListener('click', saveCurrentJob);
    btnAddSection.addEventListener('click', () => addSection());
    btnAddManualGlobal.addEventListener('click', () => {
        const lastSection = sectionsContainer.lastElementChild;
        if (lastSection) addItemToSection(lastSection, {type: 'manual'});
        else addSection().then(sec => addItemToSection(sec, {type: 'manual'}));
    });
    btnExportPdf.addEventListener('click', generatePDF);
    advancePaymentInput.addEventListener('input', calculateGlobalTotals);

    // --- Logo Handling ---
    logoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                appLogo = event.target.result;
                localStorage.setItem(LOGO_KEY, appLogo);
                pdfLogoContainer.innerHTML = `<img src="${appLogo}" alt="Logo Aziendale">`;
                alert('Logo caricato con successo!');
            };
            reader.readAsDataURL(file);
        }
    });

    function switchView(viewName) {
        if (viewName === 'home') {
            creatorView.classList.add('hidden');
            creatorView.classList.remove('active');
            homeView.classList.add('active');
            homeView.classList.remove('hidden');
            renderJobsList();
        } else {
            homeView.classList.add('hidden');
            homeView.classList.remove('active');
            creatorView.classList.add('active');
            creatorView.classList.remove('hidden');
        }
    }

    // --- Data Management ---

    function createNewJob() {
        currentJobId = Date.now().toString();
        clientNameInput.value = '';
        jobDateEl.textContent = new Date().toLocaleDateString('it-IT');
        advancePaymentInput.value = '';
        sectionsContainer.innerHTML = '';
        addSection(); // Start with one section
        calculateGlobalTotals();
    }

    function saveCurrentJob() {
        const jobData = {
            id: currentJobId,
            clientName: clientNameInput.value || 'Senza Nome',
            date: jobDateEl.textContent,
            advance: parseNumber(advancePaymentInput.value),
            sections: []
        };

        const sectionEls = document.querySelectorAll('.invoice-section');
        sectionEls.forEach(secEl => {
            const section = {
                title: secEl.querySelector('.section-title').value,
                items: []
            };

            const itemRows = secEl.querySelectorAll('.item-row');
            itemRows.forEach(row => {
                const isManual = row.classList.contains('is-manual');
                section.items.push({
                    type: isManual ? 'manual' : 'calc',
                    desc: row.querySelector('.item-desc').value,
                    qty: isManual ? 0 : parseNumber(row.querySelector('.item-qty').value),
                    price: isManual ? 0 : parseNumber(row.querySelector('.item-price').value),
                    total: isManual ? parseNumber(row.querySelector('.item-total-input').value) : (parseNumber(row.querySelector('.item-qty').value) * parseNumber(row.querySelector('.item-price').value))
                });
            });
            jobData.sections.push(section);
        });

        const index = jobs.findIndex(j => j.id === currentJobId);
        if (index > -1) {
            jobs[index] = jobData;
        } else {
            jobs.unshift(jobData);
        }

        localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
        alert('Lavoro salvato con successo!');
    }

    function loadJob(jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        currentJobId = job.id;
        clientNameInput.value = job.clientName;
        jobDateEl.textContent = job.date;
        advancePaymentInput.value = job.advance || '';
        
        sectionsContainer.innerHTML = '';
        job.sections.forEach(secData => {
            const secEl = addSection(secData.title);
            secData.items.forEach(itemData => {
                addItemToSection(secEl, itemData);
            });
        });

        calculateGlobalTotals();
        switchView('creator');
    }

    function deleteJob(jobId, event) {
        event.stopPropagation();
        if (confirm('Eliminare definitivamente questo lavoro?')) {
            jobs = jobs.filter(j => j.id !== jobId);
            localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
            renderJobsList();
        }
    }

    function renderJobsList() {
        jobsList.innerHTML = '';
        if (jobs.length === 0) {
            jobsList.innerHTML = `
                <div class="empty-state">
                    <p>Nessun preventivo salvato.</p>
                    <p>Usa il tasto + per crearne uno nuovo.</p>
                </div>`;
            return;
        }

        jobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'job-card';
            
            // Calculate total for display
            let total = 0;
            job.sections.forEach(s => {
                s.items.forEach(i => {
                    if (i.type === 'manual') total += i.total;
                    else total += (i.qty * i.price);
                });
            });
            const finalTotal = total - (job.advance || 0);

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3>${job.clientName}</h3>
                        <div class="job-date">${job.date}</div>
                    </div>
                    <button class="btn-icon no-print delete-job-btn" style="color: var(--danger);">×</button>
                </div>
                <div class="job-total">€ ${formatNumber(finalTotal)}</div>
            `;

            card.querySelector('.delete-job-btn').addEventListener('click', (e) => deleteJob(job.id, e));
            card.addEventListener('click', () => loadJob(job.id));
            jobsList.appendChild(card);
        });
    }

    // --- Creator Logic (Rows/Sections) ---

    function addSection(title = '') {
        const sectionClone = sectionTemplate.content.cloneNode(true);
        const sectionEl = sectionClone.querySelector('.invoice-section');
        
        const titleInput = sectionEl.querySelector('.section-title');
        const printTitle = sectionEl.querySelector('.print-section-title');
        titleInput.value = title;
        printTitle.textContent = title;

        titleInput.addEventListener('input', () => {
            printTitle.textContent = titleInput.value;
        });

        sectionEl.querySelector('.remove-section-btn').addEventListener('click', () => {
            sectionEl.remove();
            calculateGlobalTotals();
        });

        sectionEl.querySelector('.add-item-btn').addEventListener('click', () => {
            addItemToSection(sectionEl, {type: 'calc'});
        });

        sectionEl.querySelector('.add-manual-btn').addEventListener('click', () => {
            addItemToSection(sectionEl, {type: 'manual'});
        });

        sectionEl.addEventListener('input', (e) => {
            if (e.target.classList.contains('item-qty') || e.target.classList.contains('item-price') || e.target.classList.contains('item-total-input')) {
                const row = e.target.closest('.item-row');
                calculateRow(row);
                calculateSectionTotal(sectionEl);
                calculateGlobalTotals();
            }
        });

        sectionsContainer.appendChild(sectionEl);
        return sectionEl;
    }

    function addItemToSection(sectionEl, data = {type: 'calc', desc: '', qty: '', price: '', total: ''}) {
        const itemClone = itemTemplate.content.cloneNode(true);
        const itemRow = itemClone.querySelector('.item-row');
        const itemsList = sectionEl.querySelector('.items-list');

        if (data.type === 'manual') {
            itemRow.classList.add('is-manual');
            itemRow.querySelector('.calc-group').classList.add('no-print');
            itemRow.querySelector('.calc-group').style.display = 'none';
            const totalInput = itemRow.querySelector('.item-total-input');
            totalInput.style.display = 'inline-block';
            totalInput.value = data.total || '';
        } else {
            itemRow.querySelector('.item-qty').value = data.qty || '';
            itemRow.querySelector('.item-price').value = data.price || '';
        }
        
        itemRow.querySelector('.item-desc').value = data.desc || '';

        itemRow.querySelector('.remove-item-btn').addEventListener('click', () => {
            itemRow.remove();
            calculateSectionTotal(sectionEl);
            calculateGlobalTotals();
        });

        itemsList.appendChild(itemRow);
        calculateRow(itemRow);
    }

    // --- Calculations ---

    function formatNumber(num) {
        if (isNaN(num)) return '0,00';
        return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function parseNumber(val) {
        if (!val) return 0;
        const normalized = val.toString().replace(',', '.');
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? 0 : parsed;
    }

    function calculateRow(row) {
        const display = row.querySelector('.item-total-display');
        let total = 0;

        if (row.classList.contains('is-manual')) {
            total = parseNumber(row.querySelector('.item-total-input').value);
        } else {
            const qty = parseNumber(row.querySelector('.item-qty').value);
            const price = parseNumber(row.querySelector('.item-price').value);
            total = qty * price;
        }

        display.textContent = formatNumber(total);
        return total;
    }

    function calculateSectionTotal(sectionEl) {
        let sectionTotal = 0;
        const rows = sectionEl.querySelectorAll('.item-row');
        rows.forEach(row => {
            sectionTotal += calculateRow(row);
        });
        sectionEl.querySelector('.section-total-value').textContent = formatNumber(sectionTotal);
        return sectionTotal;
    }

    function calculateGlobalTotals() {
        let globalTotal = 0;
        const sections = document.querySelectorAll('.invoice-section');
        
        sections.forEach(sec => {
            globalTotal += calculateSectionTotal(sec);
        });

        const advance = parseNumber(advancePaymentInput.value);
        const finalBalance = globalTotal - advance;

        grandTotalEl.textContent = formatNumber(globalTotal);
        finalBalanceEl.textContent = formatNumber(finalBalance);
    }

    // --- PDF Export ---

    function generatePDF() {
        const element = document.getElementById('invoice-doc');
        
        // Ensure all input values are reflected in the PDF capture
        const inputs = element.querySelectorAll('input');
        inputs.forEach(input => input.setAttribute('value', input.value));

        const opt = {
            margin:       [15, 15, 15, 15],
            filename:     'preventivo_' + (clientNameInput.value || 'cantiere').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    }
});
