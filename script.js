
        let debugVisible = false;
        let debugLog = [];

        // Debug panel toggle
        document.getElementById('debugToggle').addEventListener('click', function() {
            const panel = document.getElementById('debugPanel');
            debugVisible = !debugVisible;
            
            if (debugVisible) {
                panel.style.display = 'block';
                this.textContent = 'Hide Debug Panel';
                this.style.backgroundColor = '#27ae60';
            } else {
                panel.style.display = 'none';
                this.textContent = 'Show Debug Panel';
                this.style.backgroundColor = '#e74c3c';
            }
        });

        // Clear debug log
        document.getElementById('clearDebug').addEventListener('click', function() {
            debugLog = [];
            document.getElementById('debugContent').innerHTML = '';
        });

        // Debug logging function
        function addDebugLog(type, title, content) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = {
                timestamp,
                type,
                title,
                content
            };
            
            debugLog.push(logEntry);
            
            const debugContent = document.getElementById('debugContent');
            const logDiv = document.createElement('div');
            
            let typeClass = '';
            switch(type) {
                case 'request': typeClass = 'request-info'; break;
                case 'response': typeClass = 'response-info'; break;
                case 'error': typeClass = 'error-info'; break;
                default: typeClass = '';
            }
            
            logDiv.innerHTML = `
                <div class="timestamp">[${timestamp}]</div>
                <div class="${typeClass}"><strong>${title}</strong></div>
                <div>${typeof content === 'object' ? JSON.stringify(content, null, 2) : content}</div>
                <hr style="border: 1px solid #34495e; margin: 15px 0;">
            `;
            
            debugContent.appendChild(logDiv);
            debugContent.scrollTop = debugContent.scrollHeight;
        }

        // Enhanced fetch function with debugging
        async function debugFetch(url, options = {}) {
            const requestInfo = {
                url: url,
                method: options.method || 'GET',
                headers: options.headers || {},
                body: options.body ? (typeof options.body === 'string' ? options.body : '[File/Blob Object]') : null
            };
            
            addDebugLog('request', 'API Request', requestInfo);
            
            try {
                const response = await fetch(url, options);
                
                const responseInfo = {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    url: response.url
                };
                
                addDebugLog('response', 'API Response Headers', responseInfo);
                
                // Clone response to read body without consuming it
                const responseClone = response.clone();
                let responseBody;
                
                try {
                    responseBody = await responseClone.json();
                } catch (e) {
                    try {
                        responseBody = await responseClone.text();
                    } catch (e2) {
                        responseBody = '[Unable to read response body]';
                    }
                }
                
                addDebugLog('response', 'API Response Body', responseBody);
                
                return response;
            } catch (error) {
                addDebugLog('error', 'API Request Error', {
                    message: error.message,
                    stack: error.stack
                });
                throw error;
            }
        }

        // Test connection with debugging
        document.getElementById('testConnection').addEventListener('click', async function() {
            const serverUrl = document.getElementById('serverUrl').value.trim();
            const apiToken = document.getElementById('apiToken').value.trim();

            if (!serverUrl || !apiToken) {
                showStatus('Please enter both server URL and API token', 'error');
                return;
            }

            const cleanServerUrl = serverUrl.replace(/\/$/, '');
            
            this.disabled = true;
            this.textContent = 'Testing...';
            
            try {
                addDebugLog('request', 'Testing Connection', { serverUrl: cleanServerUrl, apiToken: apiToken.substring(0, 8) + '...' });
                
                const userResponse = await debugFetch(`${cleanServerUrl}/api/users/:me`, {
                    method: 'GET',
                    headers: {
                        'X-Dataverse-key': apiToken,
                        'Accept': 'application/json'
                    }
                });

                if (!userResponse.ok) {
                    throw new Error('Invalid API token or server URL');
                }

                showStatus('Connection successful! Loading dataverse collections...', 'success');
                await loadDataverseCollections(cleanServerUrl, apiToken);

            } catch (error) {
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    showStatus('Connection failed: Cannot reach server. Check URL and CORS settings.', 'error');
                } else {
                    showStatus(`Connection failed: ${error.message}`, 'error');
                }
            } finally {
                this.disabled = false;
                this.textContent = 'Test Connection';
            }
        });

        // Load dataverse collections with debugging
        async function loadDataverseCollections(serverUrl, apiToken) {
            const select = document.getElementById('dataverseSelect');
            const manualInput = document.getElementById('manualInput');
            
            try {
                const response = await debugFetch(`${serverUrl}/api/dataverses/root/contents`, {
                    method: 'GET',
                    headers: {
                        'X-Dataverse-key': apiToken,
                        'Accept': 'application/json'
                    }
                });

                let collections = [{
                    alias: 'root',
                    name: 'Root Dataverse',
                    id: 1
                }];

                if (response.ok) {
                    const data = await response.json();
                    if (data.data) {
                        const childDataverses = data.data.filter(item => item.type === 'dataverse');
                        const childCollections = childDataverses.map(dv => ({
                            alias: dv.alias || dv.identifier,
                            name: dv.name || dv.title || dv.displayName || dv.alias || 'Unnamed Collection',
                            id: dv.id
                        }));
                        collections = collections.concat(childCollections);
                    }
                }

                populateDataverseSelect(collections);
                showStatus('Dataverse collections loaded successfully!', 'success');

            } catch (error) {
                select.innerHTML = `
                    <option value="">-- Enter manually below --</option>
                    <option value="root">Root Dataverse</option>
                `;
                manualInput.style.display = 'block';
                showStatus('Connected but could not load collections automatically. Please enter dataverse alias manually.', 'success');
            }
        }

        // Populate dataverse dropdown
        function populateDataverseSelect(dataverses) {
            const select = document.getElementById('dataverseSelect');
            select.innerHTML = '<option value="">-- Select Dataverse --</option>';
            
            dataverses.forEach(dv => {
                const option = document.createElement('option');
                option.value = dv.alias || dv.identifier || dv.id;
                const displayName = dv.name || dv.title || dv.displayName || dv.alias || 'Unnamed Collection';
                const aliasText = dv.alias || dv.identifier || dv.id;
                option.textContent = `${displayName} (${aliasText})`;
                select.appendChild(option);
            });

            const manualOption = document.createElement('option');
            manualOption.value = 'manual';
            manualOption.textContent = '-- Enter manually below --';
            select.appendChild(manualOption);
        }

        // Handle manual entry selection
        document.getElementById('dataverseSelect').addEventListener('change', function() {
            const manualInput = document.getElementById('manualInput');
            if (this.value === 'manual') {
                manualInput.style.display = 'block';
            } else {
                manualInput.style.display = 'none';
            }
        });

        // Clear form
        document.getElementById('clearForm').addEventListener('click', function() {
            document.getElementById('datasetForm').reset();
            document.getElementById('dataverseSelect').innerHTML = '<option value="">-- Test connection first --</option>';
            document.getElementById('manualInput').style.display = 'none';
            showStatus('Form cleared', 'success');
        });

        // Submit dataset with comprehensive debugging
        document.getElementById('datasetForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const serverUrl = document.getElementById('serverUrl').value.trim().replace(/\/$/, '');
            const apiToken = document.getElementById('apiToken').value.trim();
            let dataverseAlias = document.getElementById('dataverseSelect').value;
            const manualAlias = document.getElementById('manualAlias').value.trim();
            const persistentId ="doi:" + document.getElementById('persistentId').value.trim();
            const releaseDataset = document.getElementById('releaseDataset').checked;

            if (!serverUrl || !apiToken) {
                showStatus('Please complete the connection settings first', 'error');
                return;
            }

            if (!persistentId) {
                showStatus('Please enter a persistent identifier (PID)', 'error');
                return;
            }

            // Check if DDI file is selected
            const fileInput = document.getElementById('ddiFile');
            if (!fileInput.files[0]) {
                showStatus('Please select a DDI XML file', 'error');
                return;
            }

            // Use manual alias if selected or if no dropdown selection
            if (dataverseAlias === 'manual' || !dataverseAlias) {
                if (manualAlias) {
                    dataverseAlias = manualAlias;
                } else {
                    showStatus('Please select a dataverse or enter an alias manually', 'error');
                    return;
                }
            }

            const submitButton = document.getElementById('submitDataset');
            submitButton.disabled = true;
            submitButton.textContent = 'Importing...';

            try {
                const fileToUpload = fileInput.files[0];
                addDebugLog('request', 'Using uploaded XML file', { fileName: fileToUpload.name, size: fileToUpload.size });

                const releaseParam = releaseDataset ? 'yes' : 'no';
                const importUrl = `${serverUrl}/api/dataverses/${dataverseAlias}/datasets/:importddi?pid=${encodeURIComponent(persistentId)}&release=${releaseParam}`;

                addDebugLog('request', 'Dataset Import Parameters', {
                    serverUrl,
                    dataverseAlias,
                    persistentId,
                    releaseParam,
                    importUrl,
                    fileName: fileToUpload.name
                });

                const response = await debugFetch(importUrl, {
                    method: 'POST',
                    headers: {
                        'X-Dataverse-key': apiToken
                    },
                    body: fileToUpload
                });

                if (response.ok) {
                    const result = await response.json();
                    const successMessage = `DDI dataset imported successfully! ID: ${result.data?.id || 'N/A'}`;
                    
                    showStatus(successMessage, 'success');
                    addDebugLog('response', 'Import Success', result);
                    
                    if (confirm('Dataset imported successfully! Would you like to view it?')) {
                        const persistentIdForUrl = result.data?.persistentId || persistentId;
                        window.open(`${serverUrl}/dataset.xhtml?persistentId=${persistentIdForUrl}`, '_blank');
                    }
                } else {
                    const error = await response.json().catch(() => ({}));
                    showStatus(`Import failed: ${error.message || `HTTP ${response.status}`}`, 'error');
                    addDebugLog('error', 'Import Failed', error);
                }
            } catch (error) {
                showStatus('Import failed: ' + error.message, 'error');
                addDebugLog('error', 'Import Exception', { message: error.message, stack: error.stack });
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Import Dataset';
            }
        });

        // Show status messages
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = type;
            status.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => {
                    status.style.display = 'none';
                }, 10000);
            }
        }