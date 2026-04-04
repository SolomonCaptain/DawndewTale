#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';

// ======================= 配置 =======================
const PROJECT_ROOT = process.cwd();
const PATHS = {
  packageJson: path.join(PROJECT_ROOT, 'package.json'),
  tauriConf: path.join(PROJECT_ROOT, 'src-tauri', 'tauri.conf.json'),
  cargoToml: path.join(PROJECT_ROOT, 'src-tauri', 'Cargo.toml'),
  tauriProperties: path.join(PROJECT_ROOT, 'src-tauri', 'gen', 'android', 'app', 'tauri.properties'),
};

// ======================= 辅助函数 =======================
/** 读取 JSON 文件 */
function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/** 写入 JSON 文件 */
function writeJson(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** 从 Cargo.toml 读取 version */
function getCargoVersion(): string {
  const content = fs.readFileSync(PATHS.cargoToml, 'utf-8');
  const match = content.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error('Failed to parse version from Cargo.toml');
  return match[1];
}

/** 更新 Cargo.toml 中的 version */
function setCargoVersion(newVersion: string): void {
  let content = fs.readFileSync(PATHS.cargoToml, 'utf-8');
  content = content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
  fs.writeFileSync(PATHS.cargoToml, content, 'utf-8');
}

/** 从 tauri.properties 读取 versionName 和 versionCode */
function getAndroidVersions(): { versionName: string; versionCode: number } {
  if (!fs.existsSync(PATHS.tauriProperties)) {
    throw new Error(`tauri.properties not found at ${PATHS.tauriProperties}. Did you run 'pnpm tauri android init'?`);
  }
  const content = fs.readFileSync(PATHS.tauriProperties, 'utf-8');
  const nameMatch = content.match(/^tauri\.android\.versionName=(.+)$/m);
  const codeMatch = content.match(/^tauri\.android\.versionCode=(\d+)$/m);
  if (!nameMatch || !codeMatch) {
    throw new Error('Failed to parse Android versions from tauri.properties');
  }
  return {
    versionName: nameMatch[1].trim(),
    versionCode: parseInt(codeMatch[1], 10),
  };
}

/** 更新 tauri.properties 中的 versionName 和 versionCode（自动计算 versionCode） */
function setAndroidVersions(newVersionName: string): void {
  if (!fs.existsSync(PATHS.tauriProperties)) {
    throw new Error(`tauri.properties not found at ${PATHS.tauriProperties}. Cannot update Android version.`);
  }
  let content = fs.readFileSync(PATHS.tauriProperties, 'utf-8');
  
  // 更新 versionName
  content = content.replace(/^tauri\.android\.versionName=.*$/m, `tauri.android.versionName=${newVersionName}`);
  
  // 根据语义版本生成 versionCode (格式: MAJOR*10000 + MINOR*100 + PATCH)
  const parts = newVersionName.split('.');
  let major = 0, minor = 0, patch = 0;
  if (parts.length >= 1) major = parseInt(parts[0], 10);
  if (parts.length >= 2) minor = parseInt(parts[1], 10);
  if (parts.length >= 3) patch = parseInt(parts[2], 10);
  const newCode = major*1000000 + minor*1000 + patch;
  content = content.replace(/^tauri\.android\.versionCode=\d+$/m, `tauri.android.versionCode=${newCode}`);
  
  fs.writeFileSync(PATHS.tauriProperties, content, 'utf-8');
  console.log(`  Android versionCode updated to ${newCode} (based on ${newVersionName})`);
}

// ======================= 核心逻辑 =======================
function getAllCurrentVersions(): {
  packageJson: string;
  tauriConf: string;
  cargoToml: string;
  android: { versionName: string; versionCode: number };
} {
  const pkg = readJson(PATHS.packageJson);
  const tauri = readJson(PATHS.tauriConf);
  const cargoVersion = getCargoVersion();
  const android = getAndroidVersions();
  return {
    packageJson: pkg.version,
    tauriConf: tauri.package?.version || tauri.version,
    cargoToml: cargoVersion,
    android,
  };
}

function checkVersions(): boolean {
  console.log('🔍 Checking version consistency...\n');
  const current = getAllCurrentVersions();
  console.log(`  package.json        : ${current.packageJson}`);
  console.log(`  tauri.conf.json     : ${current.tauriConf}`);
  console.log(`  Cargo.toml          : ${current.cargoToml}`);
  console.log(`  Android versionName : ${current.android.versionName}`);
  console.log(`  Android versionCode : ${current.android.versionCode}`);
  
  const versions = [current.packageJson, current.tauriConf, current.cargoToml, current.android.versionName];
  const allEqual = versions.every(v => v === versions[0]);
  
  if (allEqual) {
    console.log('\n✅ All version fields are synchronized.');
  } else {
    console.log('\n❌ Version mismatch detected!');
  }
  return allEqual;
}

function setVersion(newVersion: string): void {
  console.log(`📝 Setting all version fields to ${newVersion}...\n`);
  
  // 1. package.json
  const pkg = readJson(PATHS.packageJson);
  pkg.version = newVersion;
  writeJson(PATHS.packageJson, pkg);
  console.log('  Updated package.json');
  
  // 2. tauri.conf.json
  const tauri = readJson(PATHS.tauriConf);
  if (tauri.package) {
    tauri.package.version = newVersion;
  } else {
    tauri.version = newVersion;
  }
  writeJson(PATHS.tauriConf, tauri);
  console.log('  Updated tauri.conf.json');
  
  // 3. Cargo.toml
  setCargoVersion(newVersion);
  console.log('  Updated Cargo.toml');
  
  // 4. Android (tauri.properties)
  setAndroidVersions(newVersion);
  console.log('  Updated tauri.properties');
  
  console.log(`\n✅ All version fields set to ${newVersion}.`);
}

// ======================= CLI 入口 =======================
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
Usage: ts-node sync-version.ts [check|set <new-version>]

Commands:
  check               Check if all version fields are in sync.
  set <new-version>   Update all version fields to the given semantic version (e.g., 1.2.3).
`);
    process.exit(1);
  }
  
  const command = args[0];
  if (command === 'check') {
    const ok = checkVersions();
    process.exit(ok ? 0 : 1);
  } else if (command === 'set') {
    const newVersion = args[1];
    if (!newVersion) {
      console.error('❌ Missing version argument for set command.');
      process.exit(1);
    }
    if (!/^\d+\.\d+\.\d+(-\w+)?$/.test(newVersion)) {
      console.error('❌ Version must follow semantic versioning (e.g., 1.2.3 or 1.2.3-beta).');
      process.exit(1);
    }
    setVersion(newVersion);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main();