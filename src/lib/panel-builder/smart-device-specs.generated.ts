// Generováno skriptem scripts/smart-device-specs.ts z prisma/external-catalog/catalog.json – neupravujte ručně
// (npm run catalog:smart-specs). Technické údaje přístrojů chytré domácnosti pro technický list (fáze 65).

import type { DeviceSpec } from "./smart-device-specs";

export const SMART_DEVICE_SPECS: Record<string, DeviceSpec> = {
  "ABB|2CDG110058R0011": {
    "typeCode": "ES/S 4.1.2.1",
    "name": "Automatizační modul ES/S 4.1.2.1",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": 4,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG110059R0011": {
    "typeCode": "ES/S 8.1.2.1",
    "name": "Automatizační modul ES/S 8.1.2.1",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": 8,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 8,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG110125R0011": {
    "typeCode": "JRA/S 4.230.5.1",
    "name": "Automatizační modul JRA/S 4.230.5.1",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": 4,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG110126R0011": {
    "typeCode": "JRA/S 8.230.5.1",
    "name": "Automatizační modul JRA/S 8.230.5.1",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": 8,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 8,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG110146R0011": {
    "typeCode": "SV/S 30.640.5.1",
    "name": "Automatizační modul SV/S 30.640.5.1",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG110262R0011": {
    "typeCode": "SA/S 4.16.2.2",
    "name": "Automatizační modul SA/S 4.16.2.2",
    "dimensions": {
      "w": 70,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG110263R0011": {
    "typeCode": "SA/S 8.16.2.2",
    "name": "Automatizační modul SA/S 8.16.2.2",
    "dimensions": {
      "w": 140,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 8,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG110264R0011": {
    "typeCode": "SA/S 12.16.2.2",
    "name": "Automatizační modul SA/S 12.16.2.2",
    "dimensions": {
      "w": 210,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 12,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CDG510001R0011": {
    "typeCode": "PS-M-64.1.1",
    "name": "Automatizační modul PS-M-64.1.1",
    "dimensions": {
      "w": 72,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": null
  },
  "ABB|2CDG510008R0011": {
    "typeCode": "HA-M-0.6.1",
    "name": "Automatizační modul HA-M-0.6.1",
    "dimensions": {
      "w": 72,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": "160 mA",
    "outputs": 6,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Počet výstupů: 6 Výstupní napětí: 24 - 230 V AC Druh zátěže: odporová Jmenovitý proud: 160 mA Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 90 × 72 × 64 mm Šířka: 4 M"
  },
  "ABB|2CDG510009R0011": {
    "typeCode": "HA-M-0.12.1",
    "name": "Automatizační modul HA-M-0.12.1",
    "dimensions": {
      "w": 144,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": "160 mA",
    "outputs": 12,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 8,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Počet výstupů: 12 Výstupní napětí: 24 - 230 V AC Druh zátěže: odporová Jmenovitý proud: 160 mA Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 90 × 144 × 64 mm Šířka: 8 M"
  },
  "ABB|2CDG510025R0011": {
    "typeCode": "SA-M-4.16.2.2",
    "name": "Automatizační modul SA-M-4.16.2.2",
    "dimensions": {
      "w": 72,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": "AC-1 16 A · AC-3 8 A",
    "outputs": 4,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Jmenovitý proud pro druh zátěže AC-1: 16 A, 230 V AC, cos ϕ = 0,8 Jmenovitý proud pro druh zátěže AC-3: 8 A, 230 V AC cos ϕ = 0,45 Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 90 × 72 × 64 mm Šířka: 4 M"
  },
  "ABB|2CDG510026R0011": {
    "typeCode": "SA-M-8.16.2.2",
    "name": "Automatizační modul SA-M-8.16.2.2",
    "dimensions": {
      "w": 140,
      "h": 100,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": "AC-1 16 A · AC-3 8 A",
    "outputs": 8,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 8,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Jmenovitý proud pro druh zátěže AC-1: 16 A, 230 V AC, cos ϕ = 0,8 Jmenovitý proud pro druh zátěže AC-3: 8 A, 230 V AC cos ϕ = 0,45 Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 100 × 140 × 64 mm Šířka: 8 M"
  },
  "ABB|2CDG510027R0011": {
    "typeCode": "SA-M-12.16.2.2",
    "name": "Automatizační modul SA-M-12.16.2.2",
    "dimensions": {
      "w": 210,
      "h": 100,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": "AC-1 16 A · AC-3 8 A",
    "outputs": 12,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 12,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Jmenovitý proud pro druh zátěže AC-1: 16 A, 230 V AC, cos ϕ = 0,8 Jmenovitý proud pro druh zátěže AC-3: 8 A, 230 V AC cos ϕ = 0,45 Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 100 × 210 × 64 mm Šířka: 12 M"
  },
  "ABB|2CDG510028R0011": {
    "typeCode": "BA-M-4.230.1.1",
    "name": "Automatizační modul BA-M-4.230.1.1",
    "dimensions": {
      "w": 72,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": "6 A",
    "outputs": 4,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 4,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Počet výstupů: 4 Druh zátěže: AC-3 Jmenovitý proud: 6 A, cos ϕ = 0,45 Výstupní napětí: 230 V AC Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 90 × 72 × 64 mm Šířka: 4 M"
  },
  "ABB|2CDG510029R0011": {
    "typeCode": "BA-M-8.230.1.1",
    "name": "Automatizační modul BA-M-8.230.1.1",
    "dimensions": {
      "w": 140,
      "h": 100,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": "6 A",
    "outputs": 8,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 8,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Počet výstupů: 8 Druh zátěže: AC-3 Jmenovitý proud: 6 A, cos ϕ = 0,45 Výstupní napětí: 230 V AC Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 100 × 140 × 64 mm Šířka: 8 M"
  },
  "ABB|2CKA006134A0319": {
    "typeCode": "6108/18-500",
    "name": "Termostat prostorový s displejem, zapuštěný",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "zapuštěná montáž do přístrojové krabice",
    "modules": null,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "KNX"
    ],
    "text": null
  },
  "ABB|2CKA006200A0871": {
    "typeCode": "SAP.3",
    "name": "Modul systémový 3.0 (SysAP), sběrnicový+WL, nástěnný",
    "dimensions": {
      "w": 119,
      "h": 107,
      "d": 30
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "nástěnná montáž",
    "modules": null,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home wireless (Bluetooth/RF)"
    ],
    "text": "24 V DC Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry (v × š × h): 107 × 119 × 30 mm Systémový modul je napájen síťovým adaptérem (230 V AC / 24 V DC), který je součástí balení. Alternativní napájení je možné zdrojem SELV např. CP-D 24/2,5 připojeným na svorky \"Power + -\" systémového modulu. Tento napájecí zdroj dokáže napájet i ovládací panely v instalaci."
  },
  "ABB|2CKA006220A0122": {
    "typeCode": "RTC-F-1",
    "name": "Termostat prostorový, zapuštěný",
    "dimensions": {
      "w": 71,
      "h": 71,
      "d": 30
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": 14,
    "mounting": "zapuštěná montáž do přístrojové krabice",
    "modules": null,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 71 × 71 × 30 mm Montážní hloubka: 14 mm"
  },
  "ABB|2CKA006220A0729": {
    "typeCode": "DA/M.4.210.2.1",
    "name": "Automatizační modul DA/M.4.210.2.1",
    "dimensions": {
      "w": 108,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 6,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 90 × 108 × 64 mm Šířka: 6 M"
  },
  "ABB|2CKA006220A0731": {
    "typeCode": "DA/M.6.210.2.1",
    "name": "Automatizační modul DA/M.6.210.2.1",
    "dimensions": {
      "w": 114,
      "h": 90,
      "d": 64
    },
    "ip": "IP20",
    "tempC": {
      "min": -5,
      "max": 45
    },
    "supply": "24 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 8,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Stupeň krytí: IP 20 Pracovní teplota: –5 °C až +45 °C Rozměry: (v × š × h): 90 × 114 × 64 mm Šířka: 8 M"
  },
  "ABB|2CKA006710A0034": {
    "typeCode": "62811 U-WL-500",
    "name": "Aktor spínací ABB-free@home WL, 1násobný, zapuštěný (1násobný (1x 2300 W))",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "zapuštěná montáž do přístrojové krabice",
    "modules": null,
    "powerLossW": null,
    "powerW": 0.3,
    "protocol": [
      "ABB-free@home wireless (Bluetooth/RF)"
    ],
    "text": null
  },
  "ABB|2CKA006710A0038": {
    "typeCode": "62851 U-WL-500",
    "name": "Aktor stmívací, 1násobný, 230 V AC, s Bluetooth a free@home WL, vestavný",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "zapuštěná montáž do přístrojové krabice",
    "modules": null,
    "powerLossW": null,
    "powerW": 0.4,
    "protocol": [
      "ABB-free@home wireless (Bluetooth/RF)"
    ],
    "text": null
  },
  "ABB|2CKA006710A0041": {
    "typeCode": "62831 U-WL-500",
    "name": "Aktor žaluziový, 1násobný, 230 V AC, s Bluetooth a free@home WL, vestavný",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "zapuštěná montáž do přístrojové krabice",
    "modules": null,
    "powerLossW": null,
    "powerW": 0.3,
    "protocol": [
      "ABB-free@home wireless (Bluetooth/RF)"
    ],
    "text": null
  },
  "ABB|2CKA006710A0048": {
    "typeCode": "62721 U-WL-500",
    "name": "Smart switch ABB-free@home®, sada pro kompletaci 63x63 mm v designech Tango®, future® linear, solo®, Busch-axcent®",
    "dimensions": null,
    "ip": null,
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "nástěnná montáž",
    "modules": null,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home wireless (Bluetooth/RF)"
    ],
    "text": null
  },
  "ABB|2CKA006710A0057": {
    "typeCode": "62821 U-WL-500",
    "name": "Aktor spínací ABB-free@home WL, 2násobný, zapuštěný (2násobný (2x 1000 W))",
    "dimensions": null,
    "ip": "IP20",
    "tempC": null,
    "supply": null,
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "zapuštěná montáž do přístrojové krabice",
    "modules": null,
    "powerLossW": null,
    "powerW": 0.3,
    "protocol": [
      "ABB-free@home wireless (Bluetooth/RF)"
    ],
    "text": null
  },
  "ABB|2TMA210050B0006": {
    "typeCode": "DP7-S-625-02",
    "name": "Panel dotykový s displejem 7\" (černá)",
    "dimensions": {
      "w": 218,
      "h": 155,
      "d": 29
    },
    "ip": "IP30",
    "tempC": null,
    "supply": "24 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "nástěnná montáž",
    "modules": null,
    "powerLossW": null,
    "powerW": null,
    "protocol": [
      "ABB-free@home bus"
    ],
    "text": "24 V DC Stupeň krytí: IP 30 Rozměry: (v × š × h): 155 × 218 × 29 mm Staré obj. číslo 2CKA008300A0357"
  },
  "LOXONE|100038": {
    "typeCode": "Relay Extension",
    "name": "Automatizační modul Relay Extension",
    "dimensions": null,
    "ip": "IP20",
    "tempC": {
      "min": -40,
      "max": 40
    },
    "supply": "18 … 28 V DC",
    "current": null,
    "outputs": 14,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 9,
    "powerLossW": 11,
    "powerW": 0.7,
    "protocol": [
      "LOXONE Link"
    ],
    "text": "18 … 28 VDC"
  },
  "LOXONE|100218": {
    "typeCode": "Tree Extension",
    "name": "Automatizační modul Tree Extension",
    "dimensions": null,
    "ip": "IP20",
    "tempC": {
      "min": -40,
      "max": 70
    },
    "supply": "9 … 28 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 2,
    "powerLossW": 0.12,
    "powerW": 0.3,
    "protocol": [
      "LOXONE Tree",
      "LOXONE Link"
    ],
    "text": "9 … 28 V DC"
  },
  "LOXONE|100335": {
    "typeCode": "Miniserver",
    "name": "Automatizační modul Miniserver",
    "dimensions": null,
    "ip": "IP20",
    "tempC": {
      "min": 0,
      "max": 50
    },
    "supply": "19,2 … 30 V DC",
    "current": null,
    "outputs": 8,
    "mountingDepthMm": null,
    "mounting": "DIN lišta TH35",
    "modules": 9,
    "powerLossW": 6.7,
    "powerW": 1.85,
    "protocol": [
      "LOXONE Tree",
      "LOXONE Link",
      "Ethernet"
    ],
    "text": "19.2 … 30 VDC"
  },
  "LOXONE|100422": {
    "typeCode": "Presence Sensor Tree White",
    "name": "Senzor přítomnosti Tree bílá",
    "dimensions": null,
    "ip": "IP30",
    "tempC": {
      "min": -25,
      "max": 70
    },
    "supply": "6 … 30 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": null,
    "modules": null,
    "powerLossW": 0.246,
    "powerW": 0.246,
    "protocol": [
      "LOXONE Tree"
    ],
    "text": "6 … 30 VDC"
  },
  "LOXONE|100608": {
    "typeCode": "Touch Pure Flex IP44 Tree Signal White",
    "name": "Touch Pure Flex IP44 Tree signální bílá",
    "dimensions": null,
    "ip": "IP44",
    "tempC": {
      "min": -20,
      "max": 40
    },
    "supply": "9 … 28 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": null,
    "modules": null,
    "powerLossW": null,
    "powerW": 0.2,
    "protocol": [
      "LOXONE Tree"
    ],
    "text": "9 … 28 V DC"
  },
  "LOXONE|100792": {
    "typeCode": "Touch Pure Tree Velvet White",
    "name": "Touch Pure Tree šedobílá",
    "dimensions": null,
    "ip": "IP30",
    "tempC": {
      "min": -20,
      "max": 70
    },
    "supply": "6 … 30 V DC",
    "current": null,
    "outputs": null,
    "mountingDepthMm": null,
    "mounting": null,
    "modules": null,
    "powerLossW": 0.095,
    "powerW": 0.049,
    "protocol": [
      "LOXONE Tree"
    ],
    "text": "6 … 30 VDC"
  }
};
