/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BrowserWindow } from "electron";
import path from "node:path";

let vaultsWindow: BrowserWindow | null = null;

const VAULTS_HTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vaults</title>
    <style>
        :root {
            color-scheme: dark;
            font-family: "Inter", "Segoe UI", sans-serif;
            --bg: #1f2225;
            --panel: #2a2e32;
            --border: #3a3f44;
            --text: #f5f5f5;
            --muted: #a0a6ad;
            --accent: #5dbb6f;
            --danger: #e25757;
        }

        body {
            margin: 0;
            background: var(--bg);
            color: var(--text);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }

        header input, header select {
            background: var(--panel);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 6px 10px;
            border-radius: 6px;
        }

        header button {
            background: var(--accent);
            border: none;
            color: #0b1f11;
            padding: 8px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        }

        header button.secondary {
            background: #3b4045;
            color: var(--text);
        }

        main {
            flex: 1;
            display: grid;
            grid-template-columns: 260px 1fr;
            gap: 16px;
            padding: 16px;
        }

        .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            overflow: auto;
        }

        .panel h3 {
            margin-top: 0;
            font-size: 15px;
        }

        .vault-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .vault-item {
            padding: 8px 10px;
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
        }

        .vault-item.active {
            border-color: var(--accent);
            background: #1f2b23;
        }

        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }

        .tab {
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text);
            cursor: pointer;
        }

        .tab.active {
            background: var(--accent);
            color: #0b1f11;
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px 14px;
        }

        .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .field label {
            font-size: 12px;
            color: var(--muted);
        }

        .field input,
        .field textarea,
        .field select {
            background: #212529;
            border: 1px solid var(--border);
            color: var(--text);
            padding: 8px;
            border-radius: 6px;
        }

        .field textarea {
            min-height: 80px;
            resize: vertical;
        }

        .field .copy-row {
            display: flex;
            gap: 6px;
        }

        .field .copy-row button {
            background: #3b4045;
            border: none;
            color: var(--text);
            padding: 6px 8px;
            border-radius: 6px;
            cursor: pointer;
        }

        .actions {
            margin-top: 12px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .actions button {
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        }

        .actions .save {
            background: var(--accent);
            color: #0b1f11;
        }

        .actions .delete {
            background: var(--danger);
            color: #fff;
        }

        .list {
            margin-top: 12px;
            border-top: 1px solid var(--border);
            padding-top: 12px;
            display: grid;
            gap: 8px;
        }

        .list-item {
            background: #202428;
            border-radius: 6px;
            padding: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }

        .list-item button {
            background: #3b4045;
            color: var(--text);
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
        }

        .sync-panel {
            display: grid;
            gap: 8px;
        }

        .sync-panel textarea {
            min-height: 120px;
        }

        .notice {
            font-size: 12px;
            color: var(--muted);
        }
    </style>
</head>
<body>
    <header>
        <strong>Vaults Test UI</strong>
        <label>Vault</label>
        <select id="vaultSelect"></select>
        <input id="vaultName" placeholder="Vault name" />
        <input id="vaultPassword" type="password" placeholder="Vault password" />
        <button id="createVault">Create</button>
        <button id="loadVault" class="secondary">Load</button>
        <button id="saveVault" class="secondary">Save</button>
        <button id="exportText" class="secondary">Export Text</button>
        <button id="exportEncrypted" class="secondary">Export Encrypted</button>
    </header>
    <main>
        <section class="panel">
            <h3>Vaults</h3>
            <div class="vault-list" id="vaultList"></div>
            <p class="notice">Loaded vaults show records/hosters/currencies. Use the sync panel to merge incoming payloads.</p>
            <div class="sync-panel">
                <label for="incomingPayload">Incoming payload JSON</label>
                <textarea id="incomingPayload" placeholder="Paste payload JSON to merge"></textarea>
                <button id="mergePayload" class="secondary">Merge payload</button>
            </div>
            <div class="sync-panel">
                <label for="exportOutput">Export output</label>
                <textarea id="exportOutput" placeholder="Exports appear here"></textarea>
            </div>
        </section>
        <section class="panel">
            <div class="tabs">
                <button class="tab active" data-tab="records">Records</button>
                <button class="tab" data-tab="hosters">Hosters</button>
                <button class="tab" data-tab="currencies">Currencies</button>
            </div>
            <div id="recordsTab" class="tab-content"></div>
            <div id="hostersTab" class="tab-content" hidden></div>
            <div id="currenciesTab" class="tab-content" hidden></div>
        </section>
    </main>
    <script>
        const vaultSelect = document.getElementById("vaultSelect");
        const vaultList = document.getElementById("vaultList");
        const vaultNameInput = document.getElementById("vaultName");
        const vaultPasswordInput = document.getElementById("vaultPassword");
        const exportOutput = document.getElementById("exportOutput");
        const incomingPayload = document.getElementById("incomingPayload");
        const tabs = document.querySelectorAll(".tab");

        let currentVaultId = null;
        let currentPayload = { records: [], hosters: [], currencies: [] };
        let selectedRecordId = null;
        let selectedHosterId = null;
        let selectedCurrencyId = null;

        function ipcCall(name, args = []) {
            const id = Math.random().toString(36).slice(2);
            return new Promise((resolve, reject) => {
                const handler = (event, payload) => {
                    if (payload.id !== id) return;
                    window.electron.off("ipcReply", handler);
                    if (payload.error) {
                        reject(new Error(payload.error));
                    } else {
                        resolve(payload.reply);
                    }
                };
                window.electron.on("ipcReply", handler);
                window.electron.send("ipcCall", { id, name, args });
            });
        }

        async function refreshVaults() {
            const vaults = await ipcCall("vaultsList");
            vaultSelect.innerHTML = "";
            vaultList.innerHTML = "";
            vaults.forEach((vault) => {
                const option = document.createElement("option");
                option.value = vault.id;
                option.textContent = vault.name;
                vaultSelect.appendChild(option);

                const item = document.createElement("div");
                item.className = "vault-item" + (vault.id === currentVaultId ? " active" : "");
                item.textContent = vault.name;
                item.addEventListener("click", () => {
                    vaultSelect.value = vault.id;
                });
                vaultList.appendChild(item);
            });
        }

        function createField(label, name, type = "text") {
            const wrapper = document.createElement("div");
            wrapper.className = "field";
            const labelEl = document.createElement("label");
            labelEl.textContent = label;
            const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
            if (type !== "textarea") {
                input.type = type;
            }
            input.dataset.field = name;
            const row = document.createElement("div");
            row.className = "copy-row";
            row.appendChild(input);
            const copyButton = document.createElement("button");
            copyButton.type = "button";
            copyButton.textContent = "Copy";
            copyButton.addEventListener("click", () => {
                navigator.clipboard.writeText(input.value || "");
            });
            row.appendChild(copyButton);
            wrapper.appendChild(labelEl);
            wrapper.appendChild(row);
            return wrapper;
        }

        function renderRecordForm() {
            const container = document.getElementById("recordsTab");
            container.innerHTML = "";
            const grid = document.createElement("div");
            grid.className = "form-grid";
            const fields = [
                ["Server name", "serverName"],
                ["Server IP", "serverIp"],
                ["Hoster ID", "hosterId"],
                ["SSH Port", "sshPort"],
                ["Root Password", "rootPassword"],
                ["Additional Users", "additionalUsers", "textarea"],
                ["Quick Commands", "quickCommands", "textarea"],
                ["Dropbear Port", "dropbearPort"],
                ["Dropbear Key", "dropbearKey", "textarea"],
                ["Dropbear LUKS Password", "dropbearLuksPassword"],
                ["LUKS Disk", "luksDisk"],
                ["Purchase Date", "purchaseDate", "date"],
                ["Renewal Date", "renewalDate", "date"],
                ["Price", "price"],
                ["Currency ID", "currencyId"],
                ["Hoster Login", "hosterLogin"],
                ["Hoster Password", "hosterPassword"],
                ["Email Login", "emailLogin"],
                ["Email Password", "emailPassword"],
                ["Notes", "notes", "textarea"],
            ];
            fields.forEach(([label, name, type]) => grid.appendChild(createField(label, name, type)));
            container.appendChild(grid);

            const actions = document.createElement("div");
            actions.className = "actions";
            const saveButton = document.createElement("button");
            saveButton.className = "save";
            saveButton.textContent = selectedRecordId ? "Update record" : "Add record";
            saveButton.addEventListener("click", () => saveRecord());
            const deleteButton = document.createElement("button");
            deleteButton.className = "delete";
            deleteButton.textContent = "Delete record";
            deleteButton.addEventListener("click", () => deleteRecord());
            actions.appendChild(saveButton);
            actions.appendChild(deleteButton);
            container.appendChild(actions);

            const list = document.createElement("div");
            list.className = "list";
            currentPayload.records.forEach((record) => {
                if (record.deletedAt) return;
                const item = document.createElement("div");
                item.className = "list-item";
                item.innerHTML =
                    "<span>" + (record.serverName || "(Unnamed)") + " — " + (record.serverIp || "") + "</span>";
                const button = document.createElement("button");
                button.textContent = "Edit";
                button.addEventListener("click", () => loadRecord(record));
                item.appendChild(button);
                list.appendChild(item);
            });
            container.appendChild(list);
        }

        function renderHosters() {
            const container = document.getElementById("hostersTab");
            container.innerHTML = "";
            const grid = document.createElement("div");
            grid.className = "form-grid";
            grid.appendChild(createField("Name", "name"));
            grid.appendChild(createField("URL", "url"));
            grid.appendChild(createField("Notes", "notes", "textarea"));
            container.appendChild(grid);
            const actions = document.createElement("div");
            actions.className = "actions";
            const saveButton = document.createElement("button");
            saveButton.className = "save";
            saveButton.textContent = selectedHosterId ? "Update hoster" : "Add hoster";
            saveButton.addEventListener("click", () => saveHoster());
            const deleteButton = document.createElement("button");
            deleteButton.className = "delete";
            deleteButton.textContent = "Delete hoster";
            deleteButton.addEventListener("click", () => deleteHoster());
            actions.appendChild(saveButton);
            actions.appendChild(deleteButton);
            container.appendChild(actions);
            const list = document.createElement("div");
            list.className = "list";
            currentPayload.hosters.forEach((hoster) => {
                if (hoster.deletedAt) return;
                const item = document.createElement("div");
                item.className = "list-item";
                item.innerHTML = "<span>" + (hoster.name || "(Unnamed)") + "</span>";
                const button = document.createElement("button");
                button.textContent = "Edit";
                button.addEventListener("click", () => loadHoster(hoster));
                item.appendChild(button);
                list.appendChild(item);
            });
            container.appendChild(list);
        }

        function renderCurrencies() {
            const container = document.getElementById("currenciesTab");
            container.innerHTML = "";
            const grid = document.createElement("div");
            grid.className = "form-grid";
            grid.appendChild(createField("Name", "name"));
            grid.appendChild(createField("Symbol", "symbol"));
            container.appendChild(grid);
            const actions = document.createElement("div");
            actions.className = "actions";
            const saveButton = document.createElement("button");
            saveButton.className = "save";
            saveButton.textContent = selectedCurrencyId ? "Update currency" : "Add currency";
            saveButton.addEventListener("click", () => saveCurrency());
            const deleteButton = document.createElement("button");
            deleteButton.className = "delete";
            deleteButton.textContent = "Delete currency";
            deleteButton.addEventListener("click", () => deleteCurrency());
            actions.appendChild(saveButton);
            actions.appendChild(deleteButton);
            container.appendChild(actions);
            const list = document.createElement("div");
            list.className = "list";
            currentPayload.currencies.forEach((currency) => {
                if (currency.deletedAt) return;
                const item = document.createElement("div");
                item.className = "list-item";
                item.innerHTML =
                    "<span>" + (currency.name || "(Unnamed)") + " (" + (currency.symbol || "") + ")</span>";
                const button = document.createElement("button");
                button.textContent = "Edit";
                button.addEventListener("click", () => loadCurrency(currency));
                item.appendChild(button);
                list.appendChild(item);
            });
            container.appendChild(list);
        }

        function getRecordFormValues() {
            const values = {};
            document.querySelectorAll("#recordsTab [data-field]").forEach((input) => {
                values[input.dataset.field] = input.value;
            });
            return values;
        }

        function getHosterFormValues() {
            const values = {};
            document.querySelectorAll("#hostersTab [data-field]").forEach((input) => {
                values[input.dataset.field] = input.value;
            });
            return values;
        }

        function getCurrencyFormValues() {
            const values = {};
            document.querySelectorAll("#currenciesTab [data-field]").forEach((input) => {
                values[input.dataset.field] = input.value;
            });
            return values;
        }

        function loadRecord(record) {
            selectedRecordId = record.id;
            document.querySelectorAll("#recordsTab [data-field]").forEach((input) => {
                input.value = record[input.dataset.field] || "";
            });
            renderRecordForm();
        }

        function loadHoster(hoster) {
            selectedHosterId = hoster.id;
            document.querySelectorAll("#hostersTab [data-field]").forEach((input) => {
                input.value = hoster[input.dataset.field] || "";
            });
            renderHosters();
        }

        function loadCurrency(currency) {
            selectedCurrencyId = currency.id;
            document.querySelectorAll("#currenciesTab [data-field]").forEach((input) => {
                input.value = currency[input.dataset.field] || "";
            });
            renderCurrencies();
        }

        function saveRecord() {
            const now = new Date().toISOString();
            const values = getRecordFormValues();
            if (!values.serverName && !values.serverIp) {
                alert("Provide at least a server name or IP.");
                return;
            }
            if (selectedRecordId) {
                const record = currentPayload.records.find((item) => item.id === selectedRecordId);
                Object.assign(record, values, { updatedAt: now, deletedAt: null });
            } else {
                currentPayload.records.push({ id: crypto.randomUUID(), ...values, updatedAt: now, deletedAt: null });
            }
            selectedRecordId = null;
            renderRecordForm();
        }

        function deleteRecord() {
            if (!selectedRecordId) return;
            const record = currentPayload.records.find((item) => item.id === selectedRecordId);
            if (record) {
                record.deletedAt = new Date().toISOString();
            }
            selectedRecordId = null;
            renderRecordForm();
        }

        function saveHoster() {
            const now = new Date().toISOString();
            const values = getHosterFormValues();
            if (!values.name) {
                alert("Provide a hoster name.");
                return;
            }
            if (selectedHosterId) {
                const hoster = currentPayload.hosters.find((item) => item.id === selectedHosterId);
                Object.assign(hoster, values, { updatedAt: now, deletedAt: null });
            } else {
                currentPayload.hosters.push({ id: crypto.randomUUID(), ...values, updatedAt: now, deletedAt: null });
            }
            selectedHosterId = null;
            renderHosters();
        }

        function deleteHoster() {
            if (!selectedHosterId) return;
            const hoster = currentPayload.hosters.find((item) => item.id === selectedHosterId);
            if (hoster) {
                hoster.deletedAt = new Date().toISOString();
            }
            selectedHosterId = null;
            renderHosters();
        }

        function saveCurrency() {
            const now = new Date().toISOString();
            const values = getCurrencyFormValues();
            if (!values.name) {
                alert("Provide a currency name.");
                return;
            }
            if (selectedCurrencyId) {
                const currency = currentPayload.currencies.find((item) => item.id === selectedCurrencyId);
                Object.assign(currency, values, { updatedAt: now, deletedAt: null });
            } else {
                currentPayload.currencies.push({ id: crypto.randomUUID(), ...values, updatedAt: now, deletedAt: null });
            }
            selectedCurrencyId = null;
            renderCurrencies();
        }

        function deleteCurrency() {
            if (!selectedCurrencyId) return;
            const currency = currentPayload.currencies.find((item) => item.id === selectedCurrencyId);
            if (currency) {
                currency.deletedAt = new Date().toISOString();
            }
            selectedCurrencyId = null;
            renderCurrencies();
        }

        function updateTabs() {
            renderRecordForm();
            renderHosters();
            renderCurrencies();
        }

        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                tabs.forEach((item) => item.classList.remove("active"));
                tab.classList.add("active");
                document.querySelectorAll(".tab-content").forEach((section) => {
                    section.hidden = section.id !== tab.dataset.tab + "Tab";
                });
            });
        });

        document.getElementById("createVault").addEventListener("click", async () => {
            const name = vaultNameInput.value.trim();
            const password = vaultPasswordInput.value;
            if (!name || !password) {
                alert("Provide a vault name and password.");
                return;
            }
            const id = crypto.randomUUID();
            await ipcCall("vaultsCreate", [id, name, password]);
            currentVaultId = id;
            currentPayload = { records: [], hosters: [], currencies: [] };
            await refreshVaults();
            updateTabs();
        });

        document.getElementById("loadVault").addEventListener("click", async () => {
            const id = vaultSelect.value;
            const password = vaultPasswordInput.value;
            if (!id || !password) {
                alert("Select a vault and provide a password.");
                return;
            }
            currentPayload = await ipcCall("vaultsLoad", [id, password]);
            currentVaultId = id;
            updateTabs();
            await refreshVaults();
        });

        document.getElementById("saveVault").addEventListener("click", async () => {
            const id = currentVaultId || vaultSelect.value;
            const name = vaultNameInput.value.trim() || vaultSelect.options[vaultSelect.selectedIndex]?.textContent || "Vault";
            const password = vaultPasswordInput.value;
            if (!id || !password) {
                alert("Select a vault and provide a password.");
                return;
            }
            await ipcCall("vaultsSave", [id, name, password, currentPayload]);
            await refreshVaults();
        });

        document.getElementById("exportText").addEventListener("click", async () => {
            const id = currentVaultId || vaultSelect.value;
            const password = vaultPasswordInput.value;
            if (!id || !password) {
                alert("Select a vault and provide a password.");
                return;
            }
            exportOutput.value = await ipcCall("vaultsExportText", [id, password]);
        });

        document.getElementById("exportEncrypted").addEventListener("click", async () => {
            const id = currentVaultId || vaultSelect.value;
            if (!id) {
                alert("Select a vault.");
                return;
            }
            exportOutput.value = await ipcCall("vaultsExportEncrypted", [id]);
        });

        document.getElementById("mergePayload").addEventListener("click", async () => {
            try {
                const incoming = JSON.parse(incomingPayload.value || "{}");
                currentPayload = await ipcCall("vaultsMerge", [currentPayload, incoming]);
                updateTabs();
            } catch (error) {
                alert("Invalid JSON payload.");
            }
        });

        refreshVaults();
        updateTabs();
    </script>
</body>
</html>`;

export function openVaultsWindow(): void {
    if (vaultsWindow) {
        vaultsWindow.focus();
        return;
    }

    const preloadScript = path.normalize(`${__dirname}/preload.cjs`);
    vaultsWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: "#1f2225",
        title: "Vaults",
        show: false,
        webPreferences: {
            preload: preloadScript,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    void vaultsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(VAULTS_HTML)}`);

    vaultsWindow.once("ready-to-show", () => {
        vaultsWindow?.show();
    });

    vaultsWindow.on("closed", () => {
        vaultsWindow = null;
    });
}
