// Demo účty fáze 17 (přepínač účtů v hlavičce). Starší uživatelé ze seed-data zůstávají
// jako autoři historických revizí a požadavků, ale přihlásit se za ně nelze.
import type { AccountType, UserRole } from "../src/generated/prisma/enums";

export const ACCOUNTS: { id: string; name: string; email: string; role: UserRole; accountType: AccountType; title: string; company: string; phone: string }[] = [
  { id: "acc-dvorak", name: "Ing. Martin Dvořák", email: "martin.dvorak@jbl-automotive.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", title: "Technický ředitel", company: "JBL Automotive Components – vedení závodu", phone: "+420 777 100 100" },
  { id: "acc-novotny", name: "Karel Novotný", email: "karel.novotny@jbl-automotive.example", role: "MAINTENANCE", accountType: "MAINTENANCE_LEAD", title: "Vedoucí údržby", company: "Závod Jablonec – Údržba", phone: "+420 777 100 110" },
  { id: "acc-svoboda", name: "Petr Svoboda", email: "petr.svoboda@jbl-automotive.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", title: "Směnový údržbář", company: "Závod Jablonec – Údržba, směna A", phone: "+420 777 100 211" },
  { id: "acc-kovar", name: "Ing. Jiří Kovář", email: "jiri.kovar@revize-kovar.example", role: "MAINTENANCE", accountType: "INSPECTOR_VTZ", title: "Revizní technik VTZ E2A", company: "Revize Kovář s.r.o.", phone: "+420 602 300 401" },
  { id: "acc-cerny", name: "Milan Černý", email: "milan.cerny@revize-kovar.example", role: "MAINTENANCE", accountType: "INSPECTOR_APPLIANCES", title: "Technik revizí spotřebičů ČSN 33 1600", company: "Revize Kovář s.r.o.", phone: "+420 602 300 402" },
  { id: "acc-krejci", name: "Ing. Tomáš Krejčí", email: "tomas.krejci@digitry.example", role: "CAE_ENGINEER", accountType: "CAE_ENGINEER", title: "CAE projektant", company: "Digitry CAE", phone: "+420 603 200 303" },
];
