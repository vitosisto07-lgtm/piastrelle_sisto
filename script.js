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
        if (confirm('Tornare alla home? Assicurati di aver salvato.')) {
            switchView('home');
        }
    });

    btnSave.addEventListener('click', saveCurrentJob);
    btnAddSection.addEventListener('click', () => addSection());
    btnExportPdf.addEventListener('click', generatePDF);
    advancePaymentInput.addEventListener('input', calculateGlobalTotals);

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
                    total: parseNumber(row.querySelector(isManual ? '.item-total-input' : '.item-total-display').textContent || row.querySelector('.item-total-input').value)
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

        localStorage.setItem('tiler_jobs', JSON.stringify(jobs));
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
            localStorage.setItem('tiler_jobs', JSON.stringify(jobs));
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
            total -= (job.advance || 0);

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3>${job.clientName}</h3>
                        <div class="job-date">${job.date}</div>
                    </div>
                    <button class="btn-icon no-print delete-job-btn" style="color: var(--danger);">×</button>
                </div>
                <div class="job-total">€ ${formatNumber(total)}</div>
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
            itemRow.querySelector('.item-total-input').classList.remove('no-print');
            itemRow.querySelector('.item-total-input').value = data.total || '';
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
            // For print we show the calc string if not manual
            const calcGroup = row.querySelector('.calc-group');
            // No extra labels needed, inputs will be hidden but values attribute is set in PDF gen
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
        
        // Hide UI elements
        const inputs = element.querySelectorAll('input');
        inputs.forEach(input => input.setAttribute('value', input.value));

        const opt = {
            margin:       10,
            filename:     'preventivo_' + (clientNameInput.value || 'cantiere').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, scrollY: 0, windowWidth: 800 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    }
});
