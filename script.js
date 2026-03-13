document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // ---- PWA Service Worker Registration & Install Logic ----
    let deferredPrompt;
    const btnInstallPwa = document.getElementById('btn-install-pwa');

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered!', reg))
            .catch(err => console.error('Service Worker Registration Failed:', err));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        deferredPrompt = e;
        btnInstallPwa.style.display = 'inline-flex';
    });

    btnInstallPwa.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
            btnInstallPwa.style.display = 'none';
        }
    });

    window.addEventListener('appinstalled', () => {
        btnInstallPwa.style.display = 'none';
        deferredPrompt = null;
        console.log('PWA was installed');
    });

    // ---- Supabase Initialization ----
    const SUPABASE_URL = 'https://kzdohqlvtgzqwnnmggof.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_TKXpTClV7SQcW9fAWzap1g_xt_szZiv';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let currentUser = null;

    // DOM Elements - Views & Tabs
    const views = document.querySelectorAll('.app-view');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // Main App DOM
    const entriesList = document.getElementById('entries-list');
    const emptyState = document.getElementById('empty-state');
    const grandTotalSpan = document.getElementById('grand-total');
    const cantiereInput = document.getElementById('cantiere');
    
    // Add Buttons
    const btnAddMq = document.getElementById('btn-add-mq');
    const btnAddTime = document.getElementById('btn-add-time');
    const btnAddFixed = document.getElementById('btn-add-fixed');
    const btnAddAcconto = document.getElementById('btn-add-acconto');
    
    const btnSave = document.getElementById('btn-save');
    const btnExport = document.getElementById('btn-export');
    
    // Templates
    const tplMq = document.getElementById('tpl-mq');
    const tplTime = document.getElementById('tpl-time');
    const tplFixed = document.getElementById('tpl-fixed');
    const tplAcconto = document.getElementById('tpl-acconto');

    // Settings DOM
    const setName = document.getElementById('set-name');
    const setAddress = document.getElementById('set-address');
    const setVat = document.getElementById('set-vat');
    const setPhone = document.getElementById('set-phone');
    const setEmail = document.getElementById('set-email');
    const setTheme = document.getElementById('set-theme');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    
    const logoInput = document.getElementById('logo-input');
    const btnUploadLogo = document.getElementById('btn-upload-logo');
    const btnRemoveLogo = document.getElementById('btn-remove-logo');
    const settingsLogoImg = document.getElementById('settings-logo-img');
    const logoPlaceholder = document.querySelector('.logo-placeholder');

    // Modals DOM
    const modalSave = document.getElementById('modal-save');
    const btnCloseModalSave = document.getElementById('btn-close-modal-save');
    const saveFolderSelect = document.getElementById('save-folder-select');
    const saveNewFolderInput = document.getElementById('save-new-folder-input');
    const btnConfirmSave = document.getElementById('btn-confirm-save');

    const modalNewFolder = document.getElementById('modal-new-folder');
    const btnCloseModalFolder = document.getElementById('btn-close-modal-folder');
    const btnNewFolder = document.getElementById('btn-new-folder'); 
    const newFolderInput = document.getElementById('new-folder-input');
    const btnConfirmNewFolder = document.getElementById('btn-confirm-new-folder');

    // Auth DOM
    const modalAuth = document.getElementById('modal-auth');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const authErrorText = document.getElementById('auth-error-text');
    const btnLogin = document.getElementById('btn-login');
    const btnSignupConfirm = document.getElementById('btn-signup-confirm');
    const btnShowSignup = document.getElementById('btn-show-signup');
    const btnShowLogin = document.getElementById('btn-show-login');
    const authLoginActions = document.getElementById('auth-login-actions');
    const authSignupActions = document.getElementById('auth-signup-actions');
    const signupExtraFields = document.getElementById('signup-extra-fields');
    const authName = document.getElementById('auth-name');
    const profileDisplayName = document.getElementById('profile-display-name');
    const btnSaveTheme = document.getElementById('btn-save-theme');
    const btnTogglePassword = document.getElementById('btn-toggle-password');
    
    const btnLogoutNew = document.getElementById('btn-logout-new');
    const btnSyncNow = document.getElementById('btn-sync-now');
    const profileEmail = document.getElementById('profile-email');

    // State Data (Will be loaded from Cloud)
    let currentEntries = []; 
    let savedEstimates = []; // Was from localStorage, now Supabase
    let customFolders = [];
    let companySettings = {}; // Was from localStorage, now Supabase
    let isSignupMode = false;

    // Apply default theme immediately to avoid flash
    document.documentElement.setAttribute('data-theme', 'blue');

    const syncFolders = () => {
        const uniqueFolders = new Set(customFolders);
        savedEstimates.forEach(est => {
            const folderName = est.cantiere || 'Generico';
            uniqueFolders.add(folderName);
        });
        customFolders = Array.from(uniqueFolders).sort();
    };

    // ---- Auth Logic ----
    const showAuthError = (msg) => {
        if(!authErrorMsg || !authErrorText) return;
        authErrorText.textContent = msg;
        authErrorMsg.style.display = 'block';
        lucide.createIcons({root: authErrorMsg});
    };

    const hideAuthError = () => {
        if(authErrorMsg) authErrorMsg.style.display = 'none';
    };

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            if(modalAuth) modalAuth.style.display = 'none';
            if(profileEmail) profileEmail.textContent = currentUser.email;
            
            // Set name from metadata if exists
            const displayName = currentUser.user_metadata?.full_name || '';
            if(profileDisplayName) profileDisplayName.textContent = displayName;
            
            await loadCloudData();
        } else {
            currentUser = null;
            modalAuth.style.display = 'flex';
        }
    };

    // Toggle between Login and Signup UI
    const toggleAuthMode = (toSignup) => {
        isSignupMode = toSignup;
        hideAuthError();
        authEmail.value = '';
        authPassword.value = '';
        if(authName) authName.value = '';

        if(isSignupMode) {
            signupExtraFields.style.display = 'block';
            authLoginActions.style.display = 'none';
            authSignupActions.style.display = 'block';
        } else {
            signupExtraFields.style.display = 'none';
            authLoginActions.style.display = 'block';
            authSignupActions.style.display = 'none';
        }
    };

    if(btnShowSignup) btnShowSignup.addEventListener('click', () => toggleAuthMode(true));
    if(btnShowLogin) btnShowLogin.addEventListener('click', () => toggleAuthMode(false));

    if(btnTogglePassword) {
        btnTogglePassword.addEventListener('click', () => {
            const isPassword = authPassword.getAttribute('type') === 'password';
            authPassword.setAttribute('type', isPassword ? 'text' : 'password');
            btnTogglePassword.innerHTML = isPassword ? 
                '<i data-lucide="eye-off" style="width: 18px; height: 18px;"></i>' : 
                '<i data-lucide="eye" style="width: 18px; height: 18px;"></i>';
            lucide.createIcons({root: btnTogglePassword});
        });
    }

    btnLogin.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value;
        hideAuthError();

        if(!email || !password) { 
            showAuthError('Inserisci email e password per accedere.');
            return; 
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if(error) {
            console.error('Supabase Login Error:', error);
            let msg = 'Email o password errati.';
            if(error.message.includes('Invalid login credentials')) {
                msg = 'Email o password non corretti. Assicurati di aver creato l\'account prima.';
            } else if(error.message.includes('Email not confirmed')) {
                msg = 'L\'email non è stata confermata. Controlla la posta o disabilita "Confirm Email" su Supabase.';
            } else {
                msg = 'Errore: ' + error.message;
            }
            showAuthError(msg);
        } else {
            showToast('Accesso effettuato!');
            await checkUser();
        }
    });

    btnSignupConfirm.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value;
        const fullName = authName.value.trim();
        hideAuthError();

        if(!email || !password) { 
            showAuthError('Email e password sono obbligatorie.');
            return; 
        }
        if(password.length < 6) {
            showAuthError('La password deve contenere almeno 6 caratteri.');
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: { full_name: fullName }
            }
        });
        
        if(error) {
            console.error('Supabase Signup Error:', error);
            showAuthError('Errore durante la creazione: ' + error.message);
        } else {
            // Check if user is created but not logged in (Email confirmation case)
            if (data.user && !data.session) {
                showAuthError('Account creato, ma è richiesta la conferma email. Controlla la tua posta o disabilita "Confirm Email" nelle impostazioni di Supabase.');
            } else {
                showToast('Account creato con successo!');
                await checkUser();
            }
        }
    });

    if(btnLogoutNew) {
        btnLogoutNew.addEventListener('click', async () => {
            try {
                // Clear state IMMEDIATELY to avoid clicking twice
                currentUser = null;
                savedEstimates = [];
                customFolders = [];
                entriesList.querySelectorAll('.entry-card').forEach(c => c.remove());
                currentEntries = [];
                updateGrandTotal();
                renderHistory();
                
                // Perform sign out
                const { error } = await supabase.auth.signOut();
                
                if(error) {
                    console.error('Logout error:', error);
                    showToast('Errore durante l\'uscita, ma i dati sono stati puliti.', 'error');
                } else {
                    showToast('Sessione chiusa correttamente');
                }
                
                // Force Auth UI
                modalAuth.style.display = 'flex';
                // Switch to first tab in UI for next login
                const firstTab = document.querySelector('.tab-btn[data-tab="view-new"]');
                if(firstTab) firstTab.click();
                
            } catch (err) {
                console.error('Unexpected logout error:', err);
                modalAuth.style.display = 'flex';
            }
        });
    }

    if(btnSyncNow) {
        btnSyncNow.addEventListener('click', async () => {
            showToast('Sincronizzazione in corso...');
            await loadCloudData();
            showToast('Dati aggiornati dal Cloud');
        });
    }

    if(btnSaveTheme) {
        btnSaveTheme.addEventListener('click', async () => {
            if(!currentUser) return;
            const theme = setTheme.value;
            document.documentElement.setAttribute('data-theme', theme);
            
            // Minimal update for theme only
            const { error } = await supabase.from('user_settings').upsert({
                user_id: currentUser.id,
                theme: theme
            }, { onConflict: 'user_id' });
            
            if(!error) {
                companySettings.theme = theme;
                showToast('Tema salvato!');
            }
        });
    }

    // ---- Cloud Sync ----
    const loadCloudData = async () => {
        // Load Settings
        const { data: settings } = await supabase.from('user_settings').select('*').single();
        if(settings) {
            companySettings = settings;
            document.documentElement.setAttribute('data-theme', companySettings.theme || 'blue');
            loadSettingsToUI();
        }

        // Load Estimates
        const { data: estimates } = await supabase.from('estimates').select('*').order('created_at', { ascending: false });
        if(estimates) {
            savedEstimates = estimates;
            
            // Format legacy dates or maintain dates from cloud
            savedEstimates = savedEstimates.map(est => {
                const dateObj = new Date(est.created_at);
                est.date = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                return est;
            });
            syncFolders();
            renderHistory();
        }
    };

    // ---- Navigation / Tabs ----
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            
            // UI Switch
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            views.forEach(v => {
                if(v.id === targetId) {
                    v.classList.add('active');
                } else {
                    v.classList.remove('active');
                }
            });

            if(targetId === 'view-history') {
                renderHistory();
            }
        });
    });

    // ---- Toast Notification ----
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconHtml = type === 'success' 
            ? `<i data-lucide="check-circle" style="color:var(--success)"></i>`
            : `<i data-lucide="alert-circle" style="color:var(--danger)"></i>`;
            
        toast.innerHTML = `${iconHtml} <span>${message}</span>`;
        container.appendChild(toast);
        lucide.createIcons({root: toast});
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // ---- Settings Logic ----
    const loadSettingsToUI = () => {
        if(companySettings.company_name) setName.value = companySettings.company_name;
        if(companySettings.company_address) setAddress.value = companySettings.company_address;
        if(companySettings.company_vat) setVat.value = companySettings.company_vat;
        if(companySettings.company_phone) setPhone.value = companySettings.company_phone;
        if(companySettings.company_email) setEmail.value = companySettings.company_email;
        if(companySettings.theme) setTheme.value = companySettings.theme;
        else setTheme.value = 'blue';
        
        if(companySettings.logo_url) {
            showLogoPreview(companySettings.logo_url);
        }
    };

    const saveSettings = async () => {
        if(!currentUser) return;
        
        const payload = {
            user_id: currentUser.id,
            company_name: setName.value,
            company_address: setAddress.value,
            company_vat: setVat.value,
            company_phone: setPhone.value,
            company_email: setEmail.value,
            theme: setTheme.value,
            logo_url: settingsLogoImg.src !== window.location.href ? settingsLogoImg.src : null
        };
        document.documentElement.setAttribute('data-theme', setTheme.value);
        
        const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' });
        
        if(error) {
            showToast('Errore salvataggio: ' + error.message, 'error');
        } else {
            companySettings = payload;
            showToast('Impostazioni salvate nel Cloud');
        }
    };

    btnSaveSettings.addEventListener('click', saveSettings);

    btnUploadLogo.addEventListener('click', () => logoInput.click());
    
    logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                showLogoPreview(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    btnRemoveLogo.addEventListener('click', () => {
        settingsLogoImg.src = '';
        settingsLogoImg.style.display = 'none';
        logoPlaceholder.style.display = 'block';
        btnRemoveLogo.style.display = 'none';
        logoInput.value = ''; 
    });

    const showLogoPreview = (src) => {
        if(!src || src === window.location.href) return;
        settingsLogoImg.src = src;
        settingsLogoImg.style.display = 'block';
        logoPlaceholder.style.display = 'none';
        btnRemoveLogo.style.display = 'inline-block';
    };

    // loadSettings removed as handled by loadCloudData via checkUser

    // ---- Math and Render Logic ----
    const formatCur = (val) => val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const parseNum = (val) => {
        if(!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '.')) || 0;
    };

    const updateGrandTotal = () => {
        let sum = 0;
        currentEntries.forEach(obj => {
            sum += obj.rowTotal || 0;
        });
        grandTotalSpan.textContent = formatCur(sum);

        if (currentEntries.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
        }
    };

    const formatItalianDate = (dateString, isAcconto) => {
        if(!dateString) return '';
        const d = new Date(dateString);
        if(isNaN(d.getTime())) return '';
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const prefix = isAcconto ? "Data Pagamento: " : "Data Lavoro: ";
        return prefix + d.toLocaleDateString('it-IT', options); 
    };

    const bindEntryCalculator = (clone, inputA, inputB, entryObjType, data) => {
        const card = clone.querySelector('.entry-card');
        const inputDesc = clone.querySelector('.input-desc');
        const rowTotalSpan = clone.querySelector('.row-total');
        const btnRemove = clone.querySelector('.btn-remove-entry');
        
        const dateDisplayBox = clone.querySelector('.date-display'); 

        const entryObj = { type: entryObjType, rowTotal: 0, el: card };
        currentEntries.push(entryObj);

        // Pre-fill data if loading from history
        if(data) {
            inputDesc.value = data.desc;
            
            if(entryObjType === 'time' || entryObjType === 'acconto') {
                if(inputA && data.dateValue) inputA.value = data.dateValue;
                if(entryObjType === 'time') {
                    if(inputB && data.price) inputB.value = Math.abs(data.price);
                } else if(entryObjType === 'acconto') {
                    if(inputB && data.total) inputB.value = Math.abs(data.total);
                }
            } else {
                if(inputA && data.qty) inputA.value = data.qty;
                if(inputB && data.price) inputB.value = data.price;
                if(inputA && !inputB && data.total) inputA.value = Math.abs(data.total); 
            }
        }

        const calc = () => {
            let tot = 0;
            
            if (entryObjType === 'time' || entryObjType === 'acconto') {
                // Time & Acconto works via Date picker and Price/Flat Total
                const flatPrice = parseNum(inputB.value);
                tot = entryObjType === 'acconto' ? -flatPrice : flatPrice; 
                
                entryObj.dateValue = inputA.value;
                if(entryObjType === 'time') {
                    entryObj.price = inputB.value;
                } else {
                    entryObj.total = -Math.abs(flatPrice); // Ensure it's negative
                }
                
                if (dateDisplayBox) {
                    dateDisplayBox.textContent = formatItalianDate(inputA.value, entryObjType === 'acconto');
                }
                
            } else if(inputA && inputB) {
                // MQ type
                const q = parseNum(inputA.value);
                const p = parseNum(inputB.value);
                tot = q * p;
                
                entryObj.qty = inputA.value;
                entryObj.price = inputB.value;
            } else if(inputA && !inputB) {
                // Fixed
                tot = parseNum(inputA.value);
                entryObj.total = inputA.value;
            }
            
            entryObj.rowTotal = tot;
            if(rowTotalSpan) rowTotalSpan.textContent = formatCur(Math.abs(tot));
            
            entryObj.desc = inputDesc.value;
            updateGrandTotal();
        };

        if(inputA) inputA.addEventListener('input', calc);
        if(inputB) inputB.addEventListener('input', calc);
        inputDesc.addEventListener('input', calc);

        btnRemove.addEventListener('click', () => {
            card.remove();
            currentEntries = currentEntries.filter(e => e !== entryObj);
            updateGrandTotal();
        });

        entriesList.appendChild(clone);
        lucide.createIcons({root: entriesList});
        calc();
    };

    const addMqEntry = (data = null) => {
        const clone = tplMq.content.cloneNode(true);
        bindEntryCalculator(clone, clone.querySelector('.input-mq'), clone.querySelector('.input-price'), 'mq', data);
    };

    const addTimeEntry = (data = null) => {
        const clone = tplTime.content.cloneNode(true);
        const dateInput = clone.querySelector('.input-date');
        const priceInput = clone.querySelector('.input-price');
        
        if(!data && dateInput) dateInput.valueAsDate = new Date();
        
        bindEntryCalculator(clone, dateInput, priceInput, 'time', data);
    };

    const addFixedEntry = (data = null) => {
        const clone = tplFixed.content.cloneNode(true);
        bindEntryCalculator(clone, clone.querySelector('.input-fixed'), null, 'fixed', data);
    };

    const addAccontoEntry = (data = null) => {
        const clone = tplAcconto.content.cloneNode(true);
        const dateInput = clone.querySelector('.input-date');
        const priceInput = clone.querySelector('.input-fixed'); // We act this as inputB
        
        if(!data && dateInput) dateInput.valueAsDate = new Date();

        bindEntryCalculator(clone, dateInput, priceInput, 'acconto', data);
    };

    btnAddMq.addEventListener('click', () => addMqEntry());
    btnAddTime.addEventListener('click', () => addTimeEntry());
    btnAddFixed.addEventListener('click', () => addFixedEntry());
    btnAddAcconto.addEventListener('click', () => addAccontoEntry());

    // ---- Folder Management & Saving ----

    btnNewFolder.addEventListener('click', () => {
        newFolderInput.value = '';
        modalNewFolder.style.display = 'flex';
    });

    btnCloseModalFolder.addEventListener('click', () => {
        modalNewFolder.style.display = 'none';
    });

    btnConfirmNewFolder.addEventListener('click', () => {
        const fname = newFolderInput.value.trim();
        if(!fname) { showToast('Inserisci un nome cartella', 'error'); return; }
        
        if(!customFolders.includes(fname)) {
            customFolders.push(fname);
            customFolders.sort();
            showToast('Cartella virtuale creata!');
            renderHistory();
        } else {
            showToast('Cartella già esistente', 'error');
        }
        modalNewFolder.style.display = 'none';
    });

    // Save Modal logic
    btnSave.addEventListener('click', () => {
        if (currentEntries.length === 0) {
            showToast('Aggiungi almeno una riga prima di salvare', 'error');
            return;
        }

        saveFolderSelect.innerHTML = '<option value="">-- Seleziona una Cartella --</option>';
        
        const currentName = cantiereInput.value.trim();
        
        customFolders.forEach(folder => {
            const opt = document.createElement('option');
            opt.value = folder;
            opt.textContent = folder;
            if(folder === currentName) opt.selected = true;
            saveFolderSelect.appendChild(opt);
        });

        saveNewFolderInput.value = '';
        modalSave.style.display = 'flex';
    });

    btnCloseModalSave.addEventListener('click', () => {
        modalSave.style.display = 'none';
    });

    btnConfirmSave.addEventListener('click', async () => {
        let selectedFolder = saveFolderSelect.value;
        const newFolderTyped = saveNewFolderInput.value.trim();

        if (newFolderTyped) {
            selectedFolder = newFolderTyped;
            if(!customFolders.includes(newFolderTyped)) {
                customFolders.push(newFolderTyped);
                customFolders.sort();
            }
        }

        if(!selectedFolder) {
            showToast('Seleziona o crea una cartella di destinazione!', 'error');
            return;
        }

        cantiereInput.value = selectedFolder;

        const estimateData = {
            user_id: currentUser.id,
            cantiere: selectedFolder,
            total: currentEntries.reduce((sum, e) => sum + e.rowTotal, 0),
            items: currentEntries.map(e => ({
                type: e.type,
                desc: e.desc,
                qty: e.type === 'mq' ? e.qty : null,
                dateValue: (e.type === 'time' || e.type === 'acconto') ? e.dateValue : null,
                price: (e.type === 'mq' || e.type === 'time') ? e.price : null,
                total: (e.type === 'fixed' || e.type === 'acconto') ? (e.type==='acconto' ? -Math.abs(e.total || e.rowTotal) : e.total) : null
            }))
        };

        const { data, error } = await supabase.from('estimates').insert([estimateData]).select();
        
        if(error) {
            showToast('Errore salvataggio Cloud: ' + error.message, 'error');
        } else if(data && data.length > 0) {
            // Unshift and sync to keep UI updated
            const est = data[0];
            const dateObj = new Date(est.created_at);
            est.date = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            savedEstimates.unshift(est);
            
            modalSave.style.display = 'none';
            showToast('Preventivo sincronizzato con il Cloud in: ' + selectedFolder);
        }
    });


    // ---- History Folders & Render ----
    const foldersList = document.getElementById('folders-list');
    const folderItemsList = document.getElementById('folder-items-list');
    const historyMainHeader = document.getElementById('history-main-header');
    const historyFolderHeader = document.getElementById('history-folder-header');
    const folderTitleDisplay = document.getElementById('folder-title-display');
    const btnBackFolders = document.getElementById('btn-back-folders');

    btnBackFolders.addEventListener('click', () => {
        folderItemsList.style.display = 'none';
        historyFolderHeader.style.display = 'none';
        foldersList.style.display = 'block';
        historyMainHeader.style.display = 'block';
        renderHistory(); 
    });

    const renderHistory = () => {
        folderItemsList.style.display = 'none';
        historyFolderHeader.style.display = 'none';
        foldersList.style.display = 'block';
        historyMainHeader.style.display = 'block';

        foldersList.innerHTML = '';
        
        if(customFolders.length === 0) {
            foldersList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i data-lucide="folder-open"></i></div>
                    <p>Nessuna cartella trovata.</p>
                    <small>Crea la tua prima cartella con il tasto in alto.</small>
                </div>
            `;
            lucide.createIcons({root: foldersList});
            return;
        }

        const foldersMap = {};
        customFolders.forEach(f => {
            foldersMap[f] = { name: f, count: 0, total: 0, items: [] };
        });

        savedEstimates.forEach(est => {
            const f = est.cantiere || 'Generico';
            if(foldersMap[f]) {
                foldersMap[f].count++;
                foldersMap[f].total += est.total;
                foldersMap[f].items.push(est);
            }
        });

        Object.values(foldersMap).forEach(folder => {
            const div = document.createElement('div');
            div.className = 'folder-card';
            div.innerHTML = `
                <div class="folder-info">
                    <h3><i data-lucide="folder" style="color:var(--accent); fill:rgba(37,99,235,0.1)"></i> ${folder.name}</h3>
                    <p>${folder.count} preventiv${folder.count === 1 ? 'o' : 'i'} - € ${formatCur(folder.total)}</p>
                </div>
                <div class="folder-action" style="display:flex; gap:10px;">
                    <button class="btn btn-danger-outline btn-small btn-del-folder" style="padding:6px;"><i data-lucide="trash-2"></i></button>
                    <div style="display:flex; align-items:center;"><i data-lucide="chevron-right" style="color:var(--text-light)"></i></div>
                </div>
            `;
            
            div.querySelector('.btn-del-folder').addEventListener('click', async (e) => {
                e.stopPropagation();
                if(confirm('Eliminare l\'intera cartella "' + folder.name + '" e TUTTI i suoi preventivi dal Cloud?')) {
                    const { error } = await supabase.from('estimates').delete().eq('cantiere', folder.name).eq('user_id', currentUser.id);
                    if(!error) {
                        customFolders = customFolders.filter(f => f !== folder.name);
                        savedEstimates = savedEstimates.filter(est => est.cantiere !== folder.name);
                        showToast('Cartella eliminata');
                        renderHistory();
                    } else {
                        showToast('Errore durante l\'eliminazione', 'error');
                    }
                }
            });

            div.addEventListener('click', () => {
                openFolder(folder);
            });
            foldersList.appendChild(div);
        });
        lucide.createIcons({root: foldersList});
    };

    const openFolder = (folder) => {
        foldersList.style.display = 'none';
        historyMainHeader.style.display = 'none';
        
        folderItemsList.style.display = 'block';
        historyFolderHeader.style.display = 'block';
        folderTitleDisplay.textContent = folder.name;

        folderItemsList.innerHTML = '';
        
        if (folder.items.length === 0) {
            folderItemsList.innerHTML = `
                <div class="empty-state">
                    <p>Cartella vuota.</p>
                    <small>Salva qui il tuo prossimo preventivo!</small>
                </div>
            `;
            return;
        }
        
        folder.items.forEach(est => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-item-header">
                    <div>
                        <div class="history-item-date"><i data-lucide="calendar" style="width:12px;height:12px;display:inline;"></i> ${est.date}</div>
                    </div>
                    <div class="history-item-total">€ ${formatCur(est.total)}</div>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-primary btn-load" data-id="${est.id}"><i data-lucide="arrow-up-right"></i> Apri/Modifica</button>
                    <button class="btn btn-danger-outline btn-del-item" data-id="${est.id}"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            folderItemsList.appendChild(div);
        });
        lucide.createIcons({root: folderItemsList});

        folderItemsList.querySelectorAll('.btn-load').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                loadEstimate(id);
                document.querySelector('.tab-btn[data-tab="view-new"]').click();
            });
        });

        folderItemsList.querySelectorAll('.btn-del-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Sei sicuro di voler eliminare questo preventivo dal Cloud?')) {
                    const id = e.currentTarget.getAttribute('data-id');
                    const { error } = await supabase.from('estimates').delete().eq('id', id);
                    if(!error) {
                        savedEstimates = savedEstimates.filter(x => x.id !== id);
                        folder.items = folder.items.filter(x => x.id !== id);
                        openFolder(folder);
                        showToast('Preventivo eliminato');
                    } else {
                        showToast('Errore durante l\'eliminazione', 'error');
                    }
                }
            });
        });
    };

    const loadEstimate = (id) => {
        const est = savedEstimates.find(x => x.id === id);
        if(!est) return;

        currentEntries = [];
        entriesList.querySelectorAll('.entry-card').forEach(c => c.remove());
        cantiereInput.value = est.cantiere;

        est.items.forEach(item => {
            if(item.type === 'mq') addMqEntry(item);
            else if(item.type === 'time') addTimeEntry(item);
            else if(item.type === 'acconto') addAccontoEntry(item);
            else addFixedEntry(item);
        });
        showToast('Preventivo caricato dalla cartella!');
    };

    // ---- Populating PDF details before export ----
    const populatePDFCompanyDetails = () => {
        document.getElementById('pdf-company-name').textContent = companySettings.company_name || 'La Tua Azienda';
        document.getElementById('pdf-company-address').textContent = companySettings.company_address || '';
        document.getElementById('pdf-company-vat').textContent = companySettings.company_vat || '';
        document.getElementById('pdf-company-phone').textContent = companySettings.company_phone || '';
        document.getElementById('pdf-company-email').textContent = companySettings.company_email || '';
        
        const logoImg = document.getElementById('pdf-company-logo');
        if(companySettings.logo_url) {
            logoImg.src = companySettings.logo_url;
            logoImg.style.display = 'block';
        } else {
            logoImg.style.display = 'none';
        }
    };

    // ---- PRE-EXPORT PDF HOOKS ----
    // ---- PDF Export ----
    btnExport.addEventListener('click', () => {
        if (currentEntries.length === 0) {
            showToast('Aggiungi voci prima di generare il PDF', 'error');
            return;
        }

        populatePDFCompanyDetails();

        const oldTheme = document.documentElement.getAttribute('data-theme');
        if(oldTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'blue'); 
        }

        document.body.classList.add('exporting');
        
        const dt = new Date().toLocaleDateString('it-IT');
        document.getElementById('pdf-current-date').textContent = dt;
        document.getElementById('pdf-site-name').textContent = cantiereInput.value || 'Generico';

        const element = document.getElementById('pdf-container');
        const opt = {
            margin:       5,
            filename:     `Preventivo_${(cantiereInput.value || 'Nuovo').replace(/\s+/g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        setTimeout(() => {
            html2pdf().set(opt).from(element).save().then(() => {
                document.body.classList.remove('exporting');
                if(oldTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
                showToast('PDF Generato con successo!');
            });
        }, 300);
    });

    // Start empty
    updateGrandTotal();
    
    // Check auth on startup
    checkUser();
});
