// Fáze 73: sestavení aplikace pro Android (Gradle) s vhodnou Javou. Gradle 8.14 z šablony Capacitoru běží na JDK
// 17–24 – Android Studio ale může mít novější JBR (JDK 25), proto se hledá vhodná Java: JAVA_HOME, JDK stažené
// Gradlem (~/.gradle/jdks), JBR Android Studia, Temurin / Microsoft / Mac / Linux. Spouštět z apps/client:
//   node scripts/android-build.mjs [assembleDebug|assembleRelease|bundleRelease]   (výchozí assembleDebug)
// Ladicí APK se zkopíruje do release/Eldock-Android-<verze>-test.apk (instalace mimo Google Play).

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const task = process.argv[2] ?? "assembleDebug";
const windows = process.platform === "win32";
const java = (home) => path.join(home, "bin", windows ? "java.exe" : "java");

function majorOf(home) {
  if (!home || !existsSync(java(home))) return null;
  // java -version píše na stderr
  const result = spawnSync(java(home), ["-version"], { encoding: "utf8" });
  return Number(/version "(\d+)/.exec(`${result.stdout ?? ""}${result.stderr ?? ""}`)?.[1]) || null;
}

function children(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

const candidates = [
  process.env.ELDOCK_ANDROID_JAVA_HOME,
  process.env.JAVA_HOME,
  ...children(path.join(os.homedir(), ".gradle", "jdks")),
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  ...children("C:\\Program Files\\Eclipse Adoptium"),
  ...children("C:\\Program Files\\Microsoft"),
  ...children("/Library/Java/JavaVirtualMachines").map((dir) => path.join(dir, "Contents", "Home")),
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  ...children("/usr/lib/jvm"),
].filter(Boolean);

const javaHome = candidates.find((home) => {
  const major = majorOf(home);
  return major !== null && major >= 17 && major <= 24;
});
if (!javaHome) {
  console.error("Nenalezena Java 17–24 pro Gradle 8.14 – nainstalujte JDK 21 (např. Eclipse Temurin) nebo nastavte ELDOCK_ANDROID_JAVA_HOME.");
  process.exit(1);
}

const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? (windows ? path.join(os.homedir(), "AppData", "Local", "Android", "Sdk") : path.join(os.homedir(), "Library", "Android", "sdk"));
if (!existsSync(sdk)) {
  console.error(`Nenalezeno Android SDK (${sdk}) – nainstalujte Android Studio nebo nastavte ANDROID_HOME.`);
  process.exit(1);
}

console.log(`Java: ${javaHome} (verze ${majorOf(javaHome)}), Android SDK: ${sdk}, úloha: ${task}`);
// Plná cesta: cmd.exe nemusí spouštět programy z aktuální složky (NoDefaultCurrentDirectoryInExePath)
const gradlew = path.resolve("android", windows ? "gradlew.bat" : "gradlew");
if (!/^[A-Za-z:]+$/.test(task)) {
  console.error(`Neplatná úloha Gradle: ${task}`);
  process.exit(1);
}
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk };
// gradlew.bat jde spustit jen přes cmd.exe – celý příkaz jako jeden řetězec (úloha je ověřená výše)
const result = windows ? spawnSync(`"${gradlew}" ${task} --console=plain`, { cwd: "android", stdio: "inherit", shell: true, env }) : spawnSync(gradlew, [task, "--console=plain"], { cwd: "android", stdio: "inherit", env });
if (result.status !== 0) process.exit(result.status ?? 1);

if (task === "assembleDebug") {
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const apk = path.join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  mkdirSync("release", { recursive: true });
  const target = path.join("release", `Eldock-Android-${version}-test.apk`);
  copyFileSync(apk, target);
  console.log(`APK: ${target}`);
}
