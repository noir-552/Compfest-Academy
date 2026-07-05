import { createApp } from './app';
import { loadClockOffset } from './lib/clock';

const PORT = Number(process.env.PORT) || 3001;

async function main(): Promise<void> {
  await loadClockOffset();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

void main();
