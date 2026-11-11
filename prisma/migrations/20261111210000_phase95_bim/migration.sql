-- Fáze 95: import BIM (IFC) – GlobalId prvku a jmenovitý příkon zařízení
ALTER TABLE "Equipment" ADD COLUMN "bimGuid" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "ratedPowerKw" REAL;
