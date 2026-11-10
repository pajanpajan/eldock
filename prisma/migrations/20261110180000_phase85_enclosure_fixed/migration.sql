-- Fáze 85: skříň / rozvodnice zvolená při zakládání projektu – lišty návrhu omezené na její řady a moduly na řadu
ALTER TABLE "PanelBoardProject" ADD COLUMN "enclosureFixed" BOOLEAN NOT NULL DEFAULT false;
