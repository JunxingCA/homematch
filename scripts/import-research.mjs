// Keep the original command, now with validation, overlap protection and atomic publication.
import { main } from "./refresh-research.mjs";
main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
