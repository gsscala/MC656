import { createApp } from './api/app';
import { ElectionController } from './api/electionController';
import { seedDemoElections } from './api/seed';

const port = Number(process.env.PORT) || 3001;
const controller = new ElectionController();
seedDemoElections(controller);

const app = createApp(controller);

app.listen(port, () => {
  console.log(`Servidor de votação auditável em http://localhost:${port}/api/elections`);
  console.log('Cenários carregados: Centro Acadêmico, Assembleia de Condomínio e Orçamento Municipal');
});
