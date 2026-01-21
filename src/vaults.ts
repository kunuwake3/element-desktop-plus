/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VAULT_DIR_NAME = "vaults";
const VAULT_INDEX_NAME = "index.json";
const VAULT_VERSION = 1;
const KDF_ITERATIONS = 310000;
const KDF_DIGEST = "sha256";
const KDF_KEYLEN = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

type VaultIndex = {
    vaults: VaultMetadata[];
};

export type VaultMetadata = {
    id: string;
    name: string;
    updatedAt: string;
};

export type VaultPayload = {
    records: VaultRecord[];
    hosters: VaultHoster[];
    currencies: VaultCurrency[];
};

export type VaultHoster = {
    id: string;
    name: string;
    url: string;
    notes: string;
    updatedAt?: string;
    deletedAt?: string | null;
};

export type VaultCurrency = {
    id: string;
    name: string;
    symbol: string;
    updatedAt?: string;
    deletedAt?: string | null;
};

export type VaultRecord = {
    id: string;
    serverName: string;
    serverIp: string;
    hosterId: string;
    sshPort: string;
    rootPassword: string;
    additionalUsers: string;
    quickCommands: string;
    dropbearPort: string;
    dropbearKey: string;
    dropbearLuksPassword: string;
    luksDisk: string;
    purchaseDate: string;
    renewalDate: string;
    price: string;
    currencyId: string;
    hosterLogin: string;
    hosterPassword: string;
    emailLogin: string;
    emailPassword: string;
    notes: string;
    updatedAt?: string;
    deletedAt?: string | null;
};

type EncryptedVault = {
    version: number;
    kdf: "pbkdf2-sha256";
    iterations: number;
    salt: string;
    iv: string;
    tag: string;
    ciphertext: string;
};

const DEFAULT_PAYLOAD: VaultPayload = {
    records: [],
    hosters: [],
    currencies: [],
};

function getVaultsDir(): string {
    return path.join(app.getPath("userData"), VAULT_DIR_NAME);
}

async function ensureVaultsDir(): Promise<void> {
    await fs.mkdir(getVaultsDir(), { recursive: true });
}

async function loadVaultIndex(): Promise<VaultIndex> {
    await ensureVaultsDir();
    const indexPath = path.join(getVaultsDir(), VAULT_INDEX_NAME);
    try {
        const content = await fs.readFile(indexPath, "utf8");
        const parsed = JSON.parse(content) as VaultIndex;
        if (!parsed.vaults) {
            return { vaults: [] };
        }
        return parsed;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return { vaults: [] };
        }
        throw error;
    }
}

async function saveVaultIndex(index: VaultIndex): Promise<void> {
    await ensureVaultsDir();
    const indexPath = path.join(getVaultsDir(), VAULT_INDEX_NAME);
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, KDF_ITERATIONS, KDF_KEYLEN, KDF_DIGEST, (error, key) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(key);
        });
    });
}

async function encryptPayload(password: string, payload: VaultPayload): Promise<EncryptedVault> {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = await deriveKey(password, salt);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const serialized = Buffer.from(JSON.stringify(payload));
    const encrypted = Buffer.concat([cipher.update(serialized), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        version: VAULT_VERSION,
        kdf: "pbkdf2-sha256",
        iterations: KDF_ITERATIONS,
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        ciphertext: encrypted.toString("base64"),
    };
}

async function decryptPayload(password: string, encrypted: EncryptedVault): Promise<VaultPayload> {
    if (encrypted.version !== VAULT_VERSION) {
        throw new Error("Unsupported vault version");
    }
    const salt = Buffer.from(encrypted.salt, "base64");
    const iv = Buffer.from(encrypted.iv, "base64");
    const tag = Buffer.from(encrypted.tag, "base64");
    const key = await deriveKey(password, salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const ciphertext = Buffer.from(encrypted.ciphertext, "base64");
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<VaultPayload>;
    return {
        ...DEFAULT_PAYLOAD,
        ...parsed,
        records: parsed.records ?? [],
        hosters: parsed.hosters ?? [],
        currencies: parsed.currencies ?? [],
    };
}

function buildVaultFilePath(id: string): string {
    return path.join(getVaultsDir(), `${id}.vault`);
}

export async function listVaults(): Promise<VaultMetadata[]> {
    const index = await loadVaultIndex();
    return index.vaults.slice();
}

export async function saveVault(
    id: string,
    name: string,
    password: string,
    payload: VaultPayload,
): Promise<VaultMetadata> {
    await ensureVaultsDir();
    const encrypted = await encryptPayload(password, payload);
    await fs.writeFile(buildVaultFilePath(id), JSON.stringify(encrypted, null, 2));
    const index = await loadVaultIndex();
    const updatedAt = new Date().toISOString();
    const existingIndex = index.vaults.findIndex((vault) => vault.id === id);
    const metadata: VaultMetadata = { id, name, updatedAt };
    if (existingIndex >= 0) {
        index.vaults[existingIndex] = metadata;
    } else {
        index.vaults.push(metadata);
    }
    await saveVaultIndex(index);
    return metadata;
}

export async function loadVault(id: string, password: string): Promise<VaultPayload> {
    const fileContent = await fs.readFile(buildVaultFilePath(id), "utf8");
    const encrypted = JSON.parse(fileContent) as EncryptedVault;
    return await decryptPayload(password, encrypted);
}

export async function deleteVault(id: string): Promise<void> {
    const index = await loadVaultIndex();
    const updatedIndex = index.vaults.filter((vault) => vault.id !== id);
    if (updatedIndex.length !== index.vaults.length) {
        await saveVaultIndex({ vaults: updatedIndex });
    }
    await fs.rm(buildVaultFilePath(id), { force: true });
}

export async function exportVaultEncrypted(id: string): Promise<string> {
    const fileContent = await fs.readFile(buildVaultFilePath(id), "utf8");
    return Buffer.from(fileContent, "utf8").toString("base64");
}

export async function importVaultEncrypted(id: string, name: string, payloadBase64: string): Promise<VaultMetadata> {
    await ensureVaultsDir();
    const data = Buffer.from(payloadBase64, "base64").toString("utf8");
    await fs.writeFile(buildVaultFilePath(id), data);
    const index = await loadVaultIndex();
    const updatedAt = new Date().toISOString();
    const metadata: VaultMetadata = { id, name, updatedAt };
    const existingIndex = index.vaults.findIndex((vault) => vault.id === id);
    if (existingIndex >= 0) {
        index.vaults[existingIndex] = metadata;
    } else {
        index.vaults.push(metadata);
    }
    await saveVaultIndex(index);
    return metadata;
}

export async function exportVaultText(id: string, password: string): Promise<string> {
    const payload = await loadVault(id, password);
    return formatVaultAsText(payload);
}

type SyncEntity = {
    id: string;
    updatedAt?: string;
    deletedAt?: string | null;
};

function parseTimestamp(value?: string | null): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function latestEntityTimestamp(entity: SyncEntity): number {
    return Math.max(parseTimestamp(entity.updatedAt), parseTimestamp(entity.deletedAt));
}

function mergeEntityLists<T extends SyncEntity>(local: T[], incoming: T[]): T[] {
    const merged = new Map<string, T>();
    for (const entity of local) {
        merged.set(entity.id, entity);
    }
    for (const entity of incoming) {
        const existing = merged.get(entity.id);
        if (!existing) {
            merged.set(entity.id, entity);
            continue;
        }
        const existingTimestamp = latestEntityTimestamp(existing);
        const incomingTimestamp = latestEntityTimestamp(entity);
        merged.set(entity.id, incomingTimestamp >= existingTimestamp ? entity : existing);
    }
    return Array.from(merged.values());
}

export function mergeVaultPayload(local: VaultPayload, incoming: VaultPayload): VaultPayload {
    return {
        records: mergeEntityLists(local.records ?? [], incoming.records ?? []),
        hosters: mergeEntityLists(local.hosters ?? [], incoming.hosters ?? []),
        currencies: mergeEntityLists(local.currencies ?? [], incoming.currencies ?? []),
    };
}

function formatVaultAsText(payload: VaultPayload): string {
    if (!Array.isArray(payload.records)) {
        return JSON.stringify(payload, null, 2);
    }
    const lines: string[] = [];
    const hosters = payload.hosters.filter((hoster) => !hoster.deletedAt);
    const currencies = payload.currencies.filter((currency) => !currency.deletedAt);
    const records = payload.records.filter((record) => !record.deletedAt);
    if (hosters.length) {
        lines.push("Hosters:");
        hosters.forEach((hoster) => {
            lines.push(`- ${hoster.name}`);
            lines.push(`  URL: ${hoster.url}`);
            if (hoster.notes) {
                lines.push(`  Notes: ${hoster.notes}`);
            }
        });
        lines.push("");
    }
    if (currencies.length) {
        lines.push("Currencies:");
        currencies.forEach((currency) => {
            lines.push(`- ${currency.name} (${currency.symbol})`);
        });
        lines.push("");
    }
    lines.push("Servers:");
    records.forEach((record, index) => {
        lines.push(`\n#${index + 1} ${record.serverName}`);
        lines.push(`Server IP: ${record.serverIp}`);
        lines.push(`Hoster ID: ${record.hosterId}`);
        lines.push(`SSH Port: ${record.sshPort}`);
        lines.push(`Root Password: ${record.rootPassword}`);
        lines.push(`Additional Users: ${record.additionalUsers}`);
        lines.push(`Quick Commands: ${record.quickCommands}`);
        lines.push(`Dropbear Port: ${record.dropbearPort}`);
        lines.push(`Dropbear Key: ${record.dropbearKey}`);
        lines.push(`Dropbear LUKS Password: ${record.dropbearLuksPassword}`);
        lines.push(`LUKS Disk: ${record.luksDisk}`);
        lines.push(`Purchase Date: ${record.purchaseDate}`);
        lines.push(`Renewal Date: ${record.renewalDate}`);
        lines.push(`Price: ${record.price}`);
        lines.push(`Currency ID: ${record.currencyId}`);
        lines.push(`Hoster Login: ${record.hosterLogin}`);
        lines.push(`Hoster Password: ${record.hosterPassword}`);
        lines.push(`Email Login: ${record.emailLogin}`);
        lines.push(`Email Password: ${record.emailPassword}`);
        lines.push(`Notes: ${record.notes}`);
    });
    return lines.join("\n");
}

export function createDefaultPayload(): VaultPayload {
    return { ...DEFAULT_PAYLOAD };
}
