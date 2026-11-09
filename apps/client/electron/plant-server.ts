// Fáze 72: server závodu v aplikaci Eldock pro Windows – bez okna a bez Chromia (Eldock.exe s ELECTRON_RUN_AS_NODE=1,
// spouští ho resources/plant-server.cmd z naplánované úlohy). Stejný kód jako `npm run plant-server`.
import { runPlantServerCli } from "@/plant-server/cli";

void runPlantServerCli();
